/**
 * Convert a File or Blob into a persistent Base64 Data URL.
 * Works seamlessly in Browser (FileReader) and provides safe fallback in Node.js.
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  if (typeof FileReader === 'undefined') {
    // Node.js fallback
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return `data:${file.type || 'image/png'};base64,${buffer.toString('base64')}`;
    } catch {
      return 'data:image/png;base64,placeholder';
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}
