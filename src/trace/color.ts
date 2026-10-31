export interface KeyColor {
  hex: string;
  r: number;
  g: number;
  b: number;
}

interface RgbaPixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function channelDistanceSq(a: number, b: number): number {
  const d = a - b;
  return d * d;
}

export function colorDistanceSq(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return channelDistanceSq(r1, r2) + channelDistanceSq(g1, g2) + channelDistanceSq(b1, b2);
}

export function rgbToHex(r: number, g: number, b: number): string {
  const hex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toLowerCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

/**
 * Picks an opaque colour that is not used in the image. Transparent pixels are
 * filled with it before tracing; paths with this exact colour are discarded
 * afterwards. This preserves transparency even when VTracer's built-in
 * transparency keying would not detect a small internal hole.
 */
export function pickKeyColor(pixels: RgbaPixels): KeyColor {
  const { data, width, height } = pixels;
  const used = new Uint8Array(32768); // 5 bits per channel
  const samples: number[] = [];
  const total = width * height;
  const sampleStep = Math.max(1, Math.floor(total / 6_000));

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel++) {
    const alpha = data[index + 3] ?? 255;
    if (alpha < 128) continue;
    const r = data[index] ?? 0;
    const g = data[index + 1] ?? 0;
    const b = data[index + 2] ?? 0;
    used[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)] = 1;
    if (pixel % sampleStep === 0 && samples.length < 6_000 * 3) {
      samples.push(r, g, b);
    }
  }

  let best = { r: 255, g: 0, b: 255, score: -1 };
  for (let r = 0; r <= 255; r += 32) {
    for (let g = 0; g <= 255; g += 32) {
      for (let b = 0; b <= 255; b += 32) {
        if (used[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)] === 1) continue;
        let minDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < samples.length; i += 3) {
          const distance = colorDistanceSq(
            r,
            g,
            b,
            samples[i] ?? 0,
            samples[i + 1] ?? 0,
            samples[i + 2] ?? 0,
          );
          if (distance < minDistance) minDistance = distance;
          if (minDistance === 0) break;
        }
        const score = minDistance === Number.POSITIVE_INFINITY ? 0 : minDistance;
        if (score > best.score) best = { r, g, b, score };
      }
    }
  }

  return { r: best.r, g: best.g, b: best.b, hex: rgbToHex(best.r, best.g, best.b) };
}

/**
 * Finds the dominant opaque colour along the image border. The median of a
 * coarse histogram is used so that a logo touching one edge does not dominate.
 */
export function estimateBorderColor(pixels: RgbaPixels): { r: number; g: number; b: number } {
  const { data, width, height } = pixels;
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  const add = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    if ((data[index + 3] ?? 0) < 128) return;
    const r = data[index] ?? 0;
    const g = data[index + 1] ?? 0;
    const b = data[index + 2] ?? 0;
    const bucket = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const current = buckets.get(bucket);
    if (current) {
      current.count += 1;
      current.r += r;
      current.g += g;
      current.b += b;
    } else {
      buckets.set(bucket, { count: 1, r, g, b });
    }
  };

  for (let x = 0; x < width; x++) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    add(0, y);
    add(width - 1, y);
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  if (!best) return { r: 255, g: 255, b: 255 };
  return { r: best.r / best.count, g: best.g / best.count, b: best.b / best.count };
}

export interface BackgroundRemovalResult {
  removedPixels: number;
  borderColor: { r: number; g: number; b: number };
}

/**
 * Removes the background by flood-filling from the image border. Interior
 * shapes with the same colour stay intact. The tolerance is a 0–100 UI value
 * mapped to an RGB distance.
 */
export function removeConnectedBackground(
  pixels: RgbaPixels,
  tolerance: number,
): BackgroundRemovalResult {
  const { data, width, height } = pixels;
  const borderColor = estimateBorderColor(pixels);
  const maxDistance = (Math.max(0, Math.min(100, tolerance)) / 100) * 160;
  const maxDistanceSq = maxDistance * maxDistance;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const matches = (x: number, y: number): boolean => {
    const index = (y * width + x) * 4;
    if ((data[index + 3] ?? 0) < 128) return false;
    return (
      colorDistanceSq(
        data[index] ?? 0,
        data[index + 1] ?? 0,
        data[index + 2] ?? 0,
        borderColor.r,
        borderColor.g,
        borderColor.b,
      ) <= maxDistanceSq
    );
  };

  const enqueue = (x: number, y: number) => {
    const position = y * width + x;
    if (visited[position] === 1) return;
    visited[position] = 1;
    if (!matches(x, y)) return;
    queue[tail++] = position;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  let removed = 0;
  while (head < tail) {
    const position = queue[head++] ?? 0;
    const x = position % width;
    const y = (position - x) / width;
    const index = position * 4;
    data[index] = 0;
    data[index + 1] = 0;
    data[index + 2] = 0;
    data[index + 3] = 0;
    removed += 1;

    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }

  return { removedPixels: removed, borderColor };
}

export function estimateColorCount(pixels: RgbaPixels): number {
  const { data } = pixels;
  const seen = new Uint8Array(32768);
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) < 128) continue;
    const bucket =
      (((data[index] ?? 0) >> 3) << 10) |
      (((data[index + 1] ?? 0) >> 3) << 5) |
      ((data[index + 2] ?? 0) >> 3);
    if (seen[bucket] === 0) {
      seen[bucket] = 1;
      count += 1;
    }
  }
  return count;
}
