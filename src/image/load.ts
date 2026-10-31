export interface SourceImage {
  id: string;
  name: string;
  baseName: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  url: string;
  image: HTMLImageElement;
}

export type ImageErrorCode =
  | 'invalidType'
  | 'svgNotSupported'
  | 'fileTooLarge'
  | 'tooManyPixels'
  | 'decodeFailed'
  | 'emptyPixels';

export class ImageLoadError extends Error {
  readonly code: ImageErrorCode;
  readonly width?: number;
  readonly height?: number;

  constructor(code: ImageErrorCode, options?: { width?: number; height?: number }) {
    super(code);
    this.name = 'ImageLoadError';
    this.code = code;
    this.width = options?.width;
    this.height = options?.height;
  }
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_SOURCE_PIXELS = 60_000_000;

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

function extensionOf(name: string): string {
  const match = /\.([^.]+)$/.exec(name);
  return match?.[1]?.toLowerCase() ?? '';
}

export function sanitizeBaseName(name: string): string {
  const withoutExtension = name.replace(/\.[^.]{1,8}$/, '');
  const cleaned = withoutExtension
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 60)
    .trim();
  return cleaned || 'vektor';
}

function detectMime(file: File): string {
  const type = file.type.toLowerCase();
  if (type === 'image/svg+xml') {
    throw new ImageLoadError('svgNotSupported');
  }
  if (type && ALLOWED_MIME.has(type)) {
    return type;
  }
  const extension = extensionOf(file.name);
  const byExtension = MIME_BY_EXTENSION[extension];
  if (byExtension) return byExtension;
  if (extension === 'svg') {
    throw new ImageLoadError('svgNotSupported');
  }
  throw new ImageLoadError('invalidType');
}

function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ImageLoadError('decodeFailed'));
    image.src = url;
  });
}

export async function loadSourceImage(file: File): Promise<SourceImage> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageLoadError('fileTooLarge');
  }
  const mime = detectMime(file);
  if (file.size === 0) {
    throw new ImageLoadError('decodeFailed');
  }

  const url = URL.createObjectURL(file);
  let image: HTMLImageElement;
  try {
    image = await decodeImage(url);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) {
    URL.revokeObjectURL(url);
    throw new ImageLoadError('emptyPixels');
  }
  if (width * height > MAX_SOURCE_PIXELS) {
    URL.revokeObjectURL(url);
    throw new ImageLoadError('tooManyPixels', { width, height });
  }

  const name = file.name || 'zwischenablage.png';
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    baseName: sanitizeBaseName(name),
    mime,
    size: file.size,
    width,
    height,
    url,
    image,
  };
}

export interface WorkingCopy {
  data: ImageData;
  width: number;
  height: number;
  scale: number;
}

export async function extractWorkingCopy(
  source: SourceImage,
  maxDimension: number,
): Promise<WorkingCopy> {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    } else {
      setTimeout(resolve, 0);
    }
  });

  const largest = Math.max(source.width, source.height);
  const scale = maxDimension > 0 && largest > maxDimension ? maxDimension / largest : 1;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: false });
  if (!context) {
    throw new ImageLoadError('decodeFailed');
  }

  context.imageSmoothingEnabled = scale !== 1;
  context.imageSmoothingQuality = 'high';
  try {
    context.drawImage(source.image, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height);
    return { data, width, height, scale };
  } catch {
    throw new ImageLoadError('decodeFailed');
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function disposeSource(source: SourceImage | null): void {
  if (source) URL.revokeObjectURL(source.url);
}
