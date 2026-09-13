export const MAX_NATIVE_ZIP_URL_LENGTH = 1800;
// Maximum EOCD comment plus the standard ZIP64 end records; never retain the archive.
const ZIP_TAIL_BYTES = 22 + 65535 + 76;
const MAX_ERROR_BYTES = 16 * 1024;

async function archiveHTTPError(response) {
  let text = '';
  const reader = response.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let size = 0;
    try {
      while (size < MAX_ERROR_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        const part = value.subarray(0, MAX_ERROR_BYTES - size);
        text += decoder.decode(part, { stream: true });
        size += part.length;
      }
      text += decoder.decode();
    } catch {
      // Preserve the HTTP status even if its diagnostic body is interrupted.
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  let detail = '';
  try {
    const payload = JSON.parse(text);
    const error = payload?.detail || payload?.error;
    detail = typeof error === 'string' ? error : typeof error?.message === 'string' ? error.message : '';
  } catch {
    if (!text.trim().startsWith('<')) detail = text.trim().slice(0, 500);
  }
  const session = response.status === 401 ? ' Sessão expirada ou inválida. Entre novamente.' : '';
  return new Error(`Falha ao baixar ZIP (HTTP ${response.status}).${session}${detail ? ` ${detail.slice(0, 500)}` : ''} O arquivo não foi salvo.`);
}

function invalidZIP() {
  return new Error('ZIP inválido ou incompleto. O arquivo parcial não foi salvo.');
}

function validateZIPEnd(tail, bytes, expectedClipCount) {
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  for (let offset = tail.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    if (offset + 22 + view.getUint16(offset + 20, true) !== tail.length) continue;
    if (view.getUint16(offset + 4, true) || view.getUint16(offset + 6, true)) continue;
    let count = view.getUint16(offset + 10, true);
    if (view.getUint16(offset + 8, true) !== count) continue;
    let directorySize = view.getUint32(offset + 12, true);
    let directoryOffset = view.getUint32(offset + 16, true);
    let directoryEnd = bytes - tail.length + offset;
    const locator = offset - 20;
    const zip64 = locator >= 0 && view.getUint32(locator, true) === 0x07064b50;
    if (zip64) {
      if (view.getUint32(locator + 4, true) || view.getUint32(locator + 16, true) !== 1) continue;
      const recordPosition = Number(view.getBigUint64(locator + 8, true));
      const record = recordPosition - (bytes - tail.length);
      if (!Number.isSafeInteger(recordPosition) || record < 0 || record + 56 > locator) continue;
      if (view.getUint32(record, true) !== 0x06064b50) continue;
      const recordSize = Number(view.getBigUint64(record + 4, true));
      if (record + 12 + recordSize !== locator) continue;
      if (view.getUint32(record + 16, true) || view.getUint32(record + 20, true)) continue;
      count = Number(view.getBigUint64(record + 32, true));
      if (view.getBigUint64(record + 24, true) !== BigInt(count)) continue;
      directorySize = Number(view.getBigUint64(record + 40, true));
      directoryOffset = Number(view.getBigUint64(record + 48, true));
      directoryEnd = recordPosition;
    } else if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
      continue;
    }
    if (![count, directorySize, directoryOffset].every(Number.isSafeInteger)) continue;
    if (count < 1 || directorySize < count * 46 || directoryOffset < 30) continue;
    if (directoryOffset + directorySize !== directoryEnd) continue;
    if (expectedClipCount != null && count !== expectedClipCount) continue;
    return;
  }
  throw invalidZIP();
}

function startNativeDownload(url, filename, document) {
  if (!url || url.length > MAX_NATIVE_ZIP_URL_LENGTH) {
    throw new Error('Seleção grande demais para o download direto. Use Chrome no computador para salvar o ZIP ou selecione menos trechos.');
  }
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
  }
  return { status: 'started', bytes: 0 };
}

async function streamZIP(handlePromise, { request, onProgress, signal, expectedClipCount }) {
  let writable;
  let reader;
  let response;
  let bytes = 0;
  let totalBytes = null;
  const checkCancelled = () => {
    if (signal?.aborted) throw new DOMException('Download cancelado.', 'AbortError');
  };
  // apiFetch only bridges abort until response headers arrive; cancel the body reader ourselves.
  const cancelReader = () => { reader?.cancel(signal?.reason).catch(() => {}); };
  const progress = (phase) => onProgress?.({ phase, bytes, totalBytes });
  try {
    const handle = await handlePromise;
    checkCancelled();
    writable = await handle.createWritable();
    checkCancelled();
    progress('connecting');
    response = await request(signal);
    checkCancelled();
    if (!response.ok) throw await archiveHTTPError(response);
    if (!/^application\/zip(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw invalidZIP();
    if (!response.body?.getReader) throw new Error('Navegador sem leitura por streaming. Use Chrome no computador.');
    const contentLength = Number(response.headers.get('content-length'));
    totalBytes = Number.isSafeInteger(contentLength) && contentLength > 0 ? contentLength : null;
    reader = response.body.getReader();
    signal?.addEventListener('abort', cancelReader, { once: true });
    checkCancelled();
    const prefix = new Uint8Array(4);
    let prefixLength = 0;
    const tail = new Uint8Array(ZIP_TAIL_BYTES);
    let tailLength = 0;
    progress('saving');
    while (true) {
      checkCancelled();
      const { done, value } = await reader.read();
      checkCancelled();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw invalidZIP();
      const prefixPart = value.subarray(0, 4 - prefixLength);
      prefix.set(prefixPart, prefixLength);
      prefixLength += prefixPart.length;
      if (prefixLength === 4 && (prefix[0] !== 0x50 || prefix[1] !== 0x4b || prefix[2] !== 3 || prefix[3] !== 4)) throw invalidZIP();
      const retained = value.subarray(Math.max(0, value.length - ZIP_TAIL_BYTES));
      const drop = Math.max(0, tailLength + retained.length - ZIP_TAIL_BYTES);
      tail.copyWithin(0, drop, tailLength);
      tailLength -= drop;
      tail.set(retained, tailLength);
      tailLength += retained.length;
      await writable.write(value);
      bytes += value.byteLength;
      progress('saving');
    }
    if (prefixLength !== 4 || (totalBytes !== null && bytes !== totalBytes)) throw invalidZIP();
    validateZIPEnd(tail.subarray(0, tailLength), bytes, expectedClipCount);
    checkCancelled();
    progress('closing');
    await writable.close();
    progress('saved');
    return { status: 'saved', bytes };
  } catch (caught) {
    if (reader) await reader.cancel(caught).catch(() => {});
    else await response?.body?.cancel?.().catch(() => {});
    if (writable) {
      try {
        await writable.abort(caught);
      } catch {
        throw new Error('Falha ao descartar o ZIP parcial. Verifique o arquivo no destino antes de tentar novamente.', { cause: caught });
      }
    }
    if (caught.name === 'AbortError') return { status: 'cancelled', bytes };
    throw caught;
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    reader?.releaseLock();
  }
}

export function saveZIP(options) {
  const browser = options.browser || globalThis.window;
  try {
    if (typeof browser?.showSaveFilePicker !== 'function') {
      return Promise.resolve(startNativeDownload(options.fallbackUrl, options.filename, options.document || globalThis.document));
    }
    // Keep the picker in the original click gesture, before any request or await.
    const handlePromise = browser.showSaveFilePicker({
      suggestedName: options.filename,
      types: [{ description: 'Arquivo ZIP', accept: { 'application/zip': ['.zip'] } }],
    });
    return streamZIP(handlePromise, options);
  } catch (caught) {
    if (caught.name === 'AbortError') return Promise.resolve({ status: 'cancelled', bytes: 0 });
    return Promise.reject(caught);
  }
}
