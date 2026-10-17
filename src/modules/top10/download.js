const PICKER_UNAVAILABLE = new Set(['SecurityError', 'NotAllowedError', 'NotSupportedError']);
const IDLE_TIMEOUT_MS = 60000;

async function httpError(response) {
  let detail = '';
  const reader = response.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let bytes = 0;
    try {
      while (bytes < 16384) {
        const { done, value } = await reader.read();
        if (done) break;
        const part = value.subarray(0, 16384 - bytes);
        detail += decoder.decode(part, { stream: true });
        bytes += part.length;
      }
      detail += decoder.decode();
      const data = JSON.parse(detail);
      detail = typeof data.detail === 'string' ? data.detail : '';
    } catch {
      detail = '';
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  return new Error(`Falha ao baixar MP4 (HTTP ${response.status}).${detail ? ` ${detail.slice(0, 500)}` : ''}`);
}

function expectedBytes(render) {
  const size = Number(render.size);
  return Number.isSafeInteger(size) && size > 0 ? size : null;
}

function validateHeaders(response, render) {
  if (response.status !== 200 || !/^video\/mp4(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
    throw new Error('O servidor nao entregou um MP4 completo. O arquivo nao foi salvo.');
  }
  const length = Number(response.headers.get('content-length'));
  const size = expectedBytes(render);
  if (size && length > 0 && size !== length) {
    throw new Error('O tamanho do MP4 nao corresponde ao video renderizado. O arquivo nao foi salvo.');
  }
  return size || (Number.isSafeInteger(length) && length > 0 ? length : null);
}

async function transfer(handlePromise, options) {
  const { request, browser, document, onProgress, refreshRender } = options;
  let render = options.render;
  let handle, writable, reader, response, timer;
  let choosingFile = Boolean(handlePromise);
  let timedOut = false;
  const controller = new AbortController();
  const armTimeout = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.idleTimeoutMs || IDLE_TIMEOUT_MS);
  };
  const cancelReader = () => { reader?.cancel().catch(() => {}); };
  controller.signal.addEventListener('abort', cancelReader);
  try {
    if (handlePromise) {
      try {
        handle = await handlePromise;
      } catch (error) {
        if (!PICKER_UNAVAILABLE.has(error.name)) throw error;
      }
    }
    choosingFile = false;
    armTimeout();
    response = await request(render.url, { method: handle ? 'GET' : 'HEAD', signal: controller.signal });
    if ([401, 403].includes(response.status) && refreshRender) {
      await response.body?.cancel?.().catch(() => {});
      const refreshed = await refreshRender();
      if (!refreshed || refreshed.filename !== render.filename) {
        throw new Error('O video exportado mudou. Atualize o projeto antes de baixar.');
      }
      render = refreshed;
      armTimeout();
      response = await request(render.url, { method: handle ? 'GET' : 'HEAD', signal: controller.signal });
    }
    if (!response.ok) throw await httpError(response);
    const total = validateHeaders(response, render);
    clearTimeout(timer);
    if (!handle) {
      // Native downloads retain the scoped signature and do not open another tab.
      const url = new URL(render.url, browser.location.href);
      url.searchParams.set('download', 'true');
      const anchor = document.createElement('a');
      anchor.href = url.href;
      anchor.download = render.filename;
      document.body.appendChild(anchor);
      try { anchor.click(); } finally { anchor.remove(); }
      return 'started';
    }
    if (!response.body?.getReader) throw new Error('Este navegador nao suporta salvar o video por streaming. Use o Chrome atualizado.');
    writable = await handle.createWritable();
    reader = response.body.getReader();
    const prefix = new Uint8Array(12);
    let prefixSize = 0;
    let size = 0;
    while (true) {
      armTimeout();
      const { done, value } = await reader.read();
      clearTimeout(timer);
      if (timedOut) throw new Error('A transferencia ficou sem resposta. Tente baixar novamente.');
      if (done) break;
      const part = value.subarray(0, prefix.length - prefixSize);
      prefix.set(part, prefixSize);
      prefixSize += part.length;
      if (prefixSize === 12 && String.fromCharCode(...prefix.subarray(4, 8)) !== 'ftyp') {
        throw new Error('O arquivo recebido nao e um MP4 valido. O arquivo nao foi salvo.');
      }
      size += value.byteLength;
      if (total && size > total) throw new Error('O tamanho recebido ultrapassou o MP4 esperado. O arquivo nao foi salvo.');
      await writable.write(value);
      onProgress?.(total ? Math.min(99, Math.round(size / total * 100)) : 0);
    }
    if (prefixSize < 12 || (total && size !== total)) {
      throw new Error('Download incompleto. O arquivo parcial foi descartado.');
    }
    await writable.close();
    onProgress?.(100);
    return 'saved';
  } catch (error) {
    if (reader) await reader.cancel().catch(() => {});
    else await response?.body?.cancel?.().catch(() => {});
    if (writable) {
      try { await writable.abort(); } catch {
        throw new Error('O MP4 nao foi concluido e o navegador nao confirmou o descarte do arquivo parcial. Confira a pasta escolhida antes de tentar novamente.');
      }
    }
    if (timedOut) throw new Error('A transferencia ficou sem resposta. Tente baixar novamente.');
    if (error.name === 'AbortError' && choosingFile) return 'cancelled';
    if (error.name === 'AbortError') throw new Error('A transferencia do MP4 foi interrompida. O arquivo parcial foi descartado; tente novamente.');
    if (['NotAllowedError', 'SecurityError', 'NoModificationAllowedError'].includes(error.name)) {
      throw new Error('O navegador ou o Windows nao permitiu salvar o MP4 nesta pasta. Escolha outra pasta e confira o aviso de seguranca, sem desativar a protecao.');
    }
    if (error instanceof TypeError) throw new Error('A conexao foi interrompida ao baixar o MP4. Tente novamente.');
    throw error;
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', cancelReader);
    reader?.releaseLock();
  }
}

export function saveTop10MP4(options) {
  const browser = options.browser || globalThis.window;
  const document = options.document || globalThis.document;
  try {
    if (!options.render?.url || !options.render?.filename) {
      throw new Error('Nenhum MP4 pronto para baixar neste projeto.');
    }
    // Open the picker during the click, before fetching metadata or media.
    let handlePromise;
    try {
      handlePromise = browser.showSaveFilePicker?.({
        suggestedName: options.render.filename,
        startIn: 'downloads',
        types: [{ description: 'Video MP4', accept: { 'video/mp4': ['.mp4'] } }],
      });
    } catch (error) {
      if (!PICKER_UNAVAILABLE.has(error.name)) throw error;
    }
    return transfer(handlePromise, { ...options, browser, document });
  } catch (error) {
    if (error.name === 'AbortError') return Promise.resolve('cancelled');
    return Promise.reject(error);
  }
}
