import { sanitizeBaseName } from '../image/load';

export const MAX_PNG_SIDE = 8192;
export const MAX_PNG_PIXELS = 60_000_000;

export function exportBaseName(sourceBaseName: string): string {
  const base = sanitizeBaseName(`${sourceBaseName}-vektor`).replace(/-vektor-vektor$/, '-vektor');
  return base;
}

export function fileNameWithExtension(base: string, extension: 'svg' | 'png'): string {
  const clean = sanitizeBaseName(base.replace(/\.(svg|png)$/i, ''));
  return `${clean}.${extension}`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_500);
}

export function downloadSvgFile(svg: string, fileName: string): void {
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), fileName);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand('copy');
    textarea.remove();
    return successful;
  } catch {
    return false;
  }
}

export interface PngRenderOptions {
  svg: string;
  width: number;
  height: number;
}

export function validatePngDimensions(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 'invalid';
  if (width < 1 || height < 1) return 'invalid';
  if (width > MAX_PNG_SIDE || height > MAX_PNG_SIDE) return 'limit';
  if (width * height > MAX_PNG_PIXELS) return 'limit';
  return null;
}

export async function renderPng(options: PngRenderOptions): Promise<Blob> {
  const { svg, width, height } = options;
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('SVG konnte nicht gerendert werden.'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas ist nicht verfügbar.');
    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    canvas.width = 0;
    canvas.height = 0;
    if (!pngBlob) throw new Error('PNG konnte nicht erzeugt werden.');
    return pngBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPngFile(options: PngRenderOptions, fileName: string): Promise<void> {
  const png = await renderPng(options);
  downloadBlob(png, fileName);
}
