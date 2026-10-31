import { estimateColorCount, pickKeyColor, removeConnectedBackground } from './color';
import type { PrepareResult, TraceParams } from './types';

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const ALPHA_THRESHOLD = 128;

/**
 * Converts the decoded RGBA image into exactly what the tracing engine needs.
 * Kept pure (apart from allocating the working buffers) so it can be unit
 * tested in Node.
 */
export function prepareTraceImage(image: RgbaImage, params: TraceParams): PrepareResult {
  const pixels = new Uint8ClampedArray(image.data);
  let backgroundRemovedPixels = 0;

  if (params.removeBackground) {
    backgroundRemovedPixels = removeConnectedBackground(
      { data: pixels, width: image.width, height: image.height },
      params.backgroundTolerance,
    ).removedPixels;
  }

  let hadTransparency = false;
  for (let index = 3; index < pixels.length; index += 4) {
    if ((pixels[index] ?? 255) < ALPHA_THRESHOLD) {
      hadTransparency = true;
      break;
    }
  }

  if (params.colorMode === 'bw') {
    // VTracer's binary mode thresholds the red channel. Make the image truly
    // grayscale so that thresholding behaves like a luminance threshold, and
    // turn transparent pixels into white paper.
    for (let index = 0; index < pixels.length; index += 4) {
      if ((pixels[index + 3] ?? 255) < ALPHA_THRESHOLD) {
        pixels[index] = 255;
        pixels[index + 1] = 255;
        pixels[index + 2] = 255;
      } else {
        const luminance = Math.round(
          0.2126 * (pixels[index] ?? 0) +
            0.7152 * (pixels[index + 1] ?? 0) +
            0.0722 * (pixels[index + 2] ?? 0),
        );
        pixels[index] = luminance;
        pixels[index + 1] = luminance;
        pixels[index + 2] = luminance;
      }
      pixels[index + 3] = 255;
    }

    return {
      pixels,
      keyColor: null,
      hadTransparency,
      backgroundRemovedPixels,
      sourceColorEstimate: estimateColorCount({ data: pixels, width: image.width, height: image.height }),
    };
  }

  let keyColor: string | null = null;
  if (hadTransparency) {
    const key = pickKeyColor({ data: pixels, width: image.width, height: image.height });
    keyColor = key.hex;
    for (let index = 0; index < pixels.length; index += 4) {
      if ((pixels[index + 3] ?? 255) < ALPHA_THRESHOLD) {
        pixels[index] = key.r;
        pixels[index + 1] = key.g;
        pixels[index + 2] = key.b;
      }
      pixels[index + 3] = 255;
    }
  } else {
    for (let index = 3; index < pixels.length; index += 4) {
      pixels[index] = 255;
    }
  }

  return {
    pixels,
    keyColor,
    hadTransparency,
    backgroundRemovedPixels,
    sourceColorEstimate: estimateColorCount({ data: pixels, width: image.width, height: image.height }),
  };
}
