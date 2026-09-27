// Photos are redrawn in the browser before upload: they upload quickly, arrive the right
// way up, and lose hidden camera details such as the GPS location of the photo.
type Picture = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function open(file: File): Promise<Picture> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Safari can show some formats (such as HEIC) in an image element that createImageBitmap refuses.
    const url = URL.createObjectURL(file), image = new Image();
    image.src = url;
    try { await image.decode(); } catch (error) { URL.revokeObjectURL(url); throw error; }
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  }
}

export async function preparePhoto(file: File, maxBytes: number) {
  let picture: Picture;
  try { picture = await open(file); } catch { throw new Error('One of your photos could not be opened. Please choose a JPEG or PNG photo.'); }
  try {
    for (const [edge, quality] of [[1600, 0.85], [1600, 0.72], [1280, 0.72], [1024, 0.65]]) {
      const scale = Math.min(1, edge / Math.max(picture.width, picture.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(picture.width * scale)); canvas.height = Math.max(1, Math.round(picture.height * scale));
      const context = canvas.getContext('2d'); if (!context) break;
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(picture.source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= maxBytes) return blob;
    }
  } finally { picture.release(); }
  throw new Error('One of your photos could not be prepared. Please try a different photo.');
}
