import { describe, expect, it } from 'vitest';
import {
  estimateColorCount,
  estimateBorderColor,
  hexToRgb,
  pickKeyColor,
  removeConnectedBackground,
  rgbToHex,
} from '../src/trace/color';
import { prepareTraceImage } from '../src/trace/preprocess';
import { DEFAULT_TRACE_PARAMS } from '../src/trace/settings';
import type { TraceParams } from '../src/trace/types';

function image(width: number, height: number, fill: [number, number, number, number] = [0, 0, 0, 0]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = fill[0];
    data[index + 1] = fill[1];
    data[index + 2] = fill[2];
    data[index + 3] = fill[3];
  }
  return { data, width, height };
}

function setPixel(
  target: { data: Uint8ClampedArray; width: number },
  x: number,
  y: number,
  [r, g, b, a]: [number, number, number, number],
) {
  const index = (y * target.width + x) * 4;
  target.data[index] = r;
  target.data[index + 1] = g;
  target.data[index + 2] = b;
  target.data[index + 3] = a;
}

function getPixel(target: { data: Uint8ClampedArray; width: number }, x: number, y: number) {
  const index = (y * target.width + x) * 4;
  return [
    target.data[index] ?? 0,
    target.data[index + 1] ?? 0,
    target.data[index + 2] ?? 0,
    target.data[index + 3] ?? 0,
  ] as const;
}

function params(patch: Partial<TraceParams> = {}): TraceParams {
  return { ...DEFAULT_TRACE_PARAMS, ...patch };
}

describe('colour helpers', () => {
  it('round-trips hex colours', () => {
    expect(rgbToHex(43, 98, 72)).toBe('#2b6248');
    expect(hexToRgb('#2B6248')).toEqual({ r: 43, g: 98, b: 72 });
    expect(hexToRgb('2b6248')).toEqual({ r: 43, g: 98, b: 72 });
    expect(hexToRgb('#abcd')).toBeNull();
    expect(hexToRgb('nope')).toBeNull();
  });

  it('picks an unused key colour for transparency', () => {
    const source = image(20, 20, [255, 255, 255, 255]);
    const key = pickKeyColor(source);
    const keyBucket = ((key.r >> 3) << 10) | ((key.g >> 3) << 5) | (key.b >> 3);
    const whiteBucket = ((255 >> 3) << 10) | ((255 >> 3) << 5) | (255 >> 3);
    expect(keyBucket).not.toBe(whiteBucket);
    expect(key.hex).toBe(rgbToHex(key.r, key.g, key.b));
  });

  it('estimates the dominant border colour instead of a single corner', () => {
    const source = image(9, 9, [240, 240, 240, 255]);
    for (let x = 3; x < 6; x += 1) {
      for (let y = 3; y < 6; y += 1) setPixel(source, x, y, [10, 10, 10, 255]);
    }
    expect(estimateBorderColor(source)).toEqual({ r: 240, g: 240, b: 240 });
  });

  it('counts quantized opaque colours', () => {
    const source = image(4, 1);
    setPixel(source, 0, 0, [255, 0, 0, 255]);
    setPixel(source, 1, 0, [250, 0, 0, 255]);
    setPixel(source, 2, 0, [0, 0, 255, 255]);
    expect(estimateColorCount(source)).toBe(2);
  });
});

describe('transparency preprocessing', () => {
  it('replaces transparent pixels with an unused key colour', () => {
    const source = image(6, 6);
    for (let y = 1; y < 5; y += 1) {
      for (let x = 1; x < 5; x += 1) setPixel(source, x, y, [200, 30, 40, 255]);
    }

    const prepared = prepareTraceImage(source, params());
    expect(prepared.hadTransparency).toBe(true);
    expect(prepared.keyColor).not.toBeNull();
    const key = hexToRgb(prepared.keyColor!);
    expect(key).not.toBeNull();

    for (let index = 0; index < prepared.pixels.length; index += 4) {
      expect(prepared.pixels[index + 3]).toBe(255);
    }

    const corner = getPixel(
      { data: prepared.pixels, width: 6 },
      0,
      0,
    );
    expect(corner.slice(0, 3)).toEqual([key!.r, key!.g, key!.b]);

    const centre = getPixel(
      { data: prepared.pixels, width: 6 },
      3,
      3,
    );
    expect(centre).toEqual([200, 30, 40, 255]);
  });

  it('leaves fully opaque images untouched', () => {
    const source = image(3, 3, [12, 34, 56, 255]);
    const prepared = prepareTraceImage(source, params());
    expect(prepared.hadTransparency).toBe(false);
    expect(prepared.keyColor).toBeNull();
    expect(Array.from(prepared.pixels)).toEqual(Array.from(source.data));
  });

  it('converts to grayscale and white paper in black-and-white mode', () => {
    const source = image(3, 2, [0, 0, 0, 0]);
    setPixel(source, 1, 0, [255, 0, 0, 255]);
    setPixel(source, 2, 0, [0, 0, 0, 255]);
    const prepared = prepareTraceImage(source, params({ colorMode: 'bw' }));

    expect(prepared.hadTransparency).toBe(true);
    expect(prepared.keyColor).toBeNull();
    expect(getPixel({ data: prepared.pixels, width: 3 }, 0, 0)).toEqual([255, 255, 255, 255]);
    const redLuminance = Math.round(0.2126 * 255);
    expect(getPixel({ data: prepared.pixels, width: 3 }, 1, 0)).toEqual([
      redLuminance,
      redLuminance,
      redLuminance,
      255,
    ]);
    expect(getPixel({ data: prepared.pixels, width: 3 }, 2, 0)).toEqual([0, 0, 0, 255]);
  });
});

describe('background removal', () => {
  it('removes only the border-connected background', () => {
    const source = image(10, 10, [255, 255, 255, 255]);
    for (let y = 3; y < 7; y += 1) {
      for (let x = 3; x < 7; x += 1) setPixel(source, x, y, [220, 30, 30, 255]);
    }

    const result = removeConnectedBackground(source, 12);
    expect(result.removedPixels).toBe(84);
    expect(getPixel(source, 0, 0)[3]).toBe(0);
    expect(getPixel(source, 5, 5)).toEqual([220, 30, 30, 255]);
  });

  it('keeps an enclosed pocket of the background colour', () => {
    const source = image(9, 9, [255, 0, 0, 255]);
    for (let y = 2; y < 7; y += 1) {
      for (let x = 2; x < 7; x += 1) setPixel(source, x, y, [255, 255, 255, 255]);
    }

    const result = removeConnectedBackground(source, 12);
    expect(result.removedPixels).toBe(81 - 25);
    expect(getPixel(source, 4, 4)).toEqual([255, 255, 255, 255]);
    expect(getPixel(source, 0, 0)[3]).toBe(0);
  });

  it('feeds removed background pixels into the transparency key', () => {
    const source = image(8, 8, [250, 250, 250, 255]);
    for (let y = 3; y < 5; y += 1) {
      for (let x = 3; x < 5; x += 1) setPixel(source, x, y, [30, 120, 60, 255]);
    }

    const prepared = prepareTraceImage(
      source,
      params({ removeBackground: true, backgroundTolerance: 10 }),
    );
    expect(prepared.backgroundRemovedPixels).toBe(60);
    expect(prepared.hadTransparency).toBe(true);
    expect(prepared.keyColor).not.toBeNull();
    const key = hexToRgb(prepared.keyColor!);
    expect(key).not.toBeNull();
    expect(getPixel({ data: prepared.pixels, width: 8 }, 0, 0).slice(0, 3)).toEqual([
      key!.r,
      key!.g,
      key!.b,
    ]);
    expect(getPixel({ data: prepared.pixels, width: 8 }, 3, 3)).toEqual([30, 120, 60, 255]);
  });

  it('removes an exact border colour even at zero tolerance', () => {
    const source = image(4, 4, [10, 10, 10, 255]);
    const result = removeConnectedBackground(source, 0);
    expect(result.removedPixels).toBe(16);
  });
});
