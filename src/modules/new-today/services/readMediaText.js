async function frameBlob(file, atSeconds, maxSide = 0, mimeType = 'image/png') {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Não foi possível ler o vídeo.'));
    });
    video.currentTime = Math.max(0, Math.min(atSeconds, video.duration - 0.1));
    await new Promise((resolve, reject) => {
      video.onseeked = resolve;
      video.onerror = () => reject(new Error('Não foi possível ler o quadro do vídeo.'));
    });
    const canvas = document.createElement('canvas');
    const scale = maxSide ? Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight)) : 1;
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Quadro vazio.')), mimeType, 0.78));
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível preparar a imagem para análise.'));
    reader.readAsDataURL(blob);
  });
}

export async function materialSamples(file, type, seconds = 0) {
  if (type === 'video') {
    const times = [0.5, Math.max(0.5, seconds * 0.5)];
    const samples = [];
    for (const time of times) {
      samples.push(await blobDataUrl(await frameBlob(file, time, 1200, 'image/jpeg')));
    }
    return samples;
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return [canvas.toDataURL('image/jpeg', 0.78)];
  } finally {
    bitmap.close();
  }
}

export async function readMediaText(file, type, seconds = 0) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['por', 'eng']);
  try {
    const images = type === 'video'
      ? await Promise.all([0.5, Math.max(1, seconds * 0.5), Math.max(1, seconds - 1)].map((time) => frameBlob(file, time)))
      : [file];
    const lines = new Set();
    for (const image of images) {
      const result = await worker.recognize(image);
      String(result.data.text || '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 3).forEach((line) => lines.add(line));
    }
    return [...lines].join('\n');
  } finally {
    await worker.terminate();
  }
}
