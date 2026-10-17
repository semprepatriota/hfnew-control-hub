const normalize = text => String(text || '').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '');

export function locateCaptionWords(words, originalText, width = 540, height = 960) {
  const target = new Set(originalText.split(/\s+/).map(normalize).filter(Boolean));
  const found = words.filter(word => word.confidence >= 45 && word.bbox && target.has(normalize(word.text)));
  const matched = new Set(found.map(word => normalize(word.text)));
  if (!target.size || matched.size < Math.min(target.size, Math.max(2, Math.ceil(target.size * .6)))) return null;
  const left = Math.min(...found.map(word => word.bbox.x0));
  const top = Math.min(...found.map(word => word.bbox.y0));
  const right = Math.max(...found.map(word => word.bbox.x1));
  const bottom = Math.max(...found.map(word => word.bbox.y1));
  if (left < 0 || top < 0 || right > width || bottom > height || right <= left || bottom <= top) return null;
  return {x:left/width,y:top/height,width:(right-left)/width,height:(bottom-top)/height};
}

export async function locateOriginalCaption(referenceUrl, originalText, workerOptions = {}) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, workerOptions);
  try {
    const {data} = await worker.recognize(referenceUrl, {}, {blocks:true});
    const words = (data.blocks || []).flatMap(block => (block.paragraphs || []).flatMap(paragraph => (paragraph.lines || []).flatMap(line => line.words || [])));
    return locateCaptionWords(words, originalText);
  } finally { await worker.terminate(); }
}
