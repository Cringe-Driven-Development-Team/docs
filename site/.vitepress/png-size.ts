// Размер PNG из чанка IHDR: ширина — байты 16–19, высота — 20–23, big-endian.
// Без Bun и node:fs: читают и скрипты под bun, и загрузчик данных VitePress под node.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface ImageSize {
  width: number;
  height: number;
}

// Меньше 24 байт или не PNG — undefined.
export function parsePngSize(bytes: Uint8Array): ImageSize | undefined {
  if (bytes.length < 24 || PNG_SIGNATURE.some((byte, i) => bytes[i] !== byte)) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
