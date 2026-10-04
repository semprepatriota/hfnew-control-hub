async function frameBlob(file, atSeconds) {
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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Quadro vazio.')), 'image/png'));
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
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
