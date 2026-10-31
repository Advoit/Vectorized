import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import init, { type InitInput } from '../src/vendor/vtracer/vtracer';
import { traceToSvg, type VtracerConfig } from '../src/vendor/vtracer';
import { parseVtracerSvg, buildSvgDocument } from '../src/trace/postprocess';
import { prepareTraceImage } from '../src/trace/preprocess';
import { DEFAULT_TRACE_PARAMS } from '../src/trace/settings';
import type { TraceParams } from '../src/trace/types';

const wasmPath = fileURLToPath(new URL('../src/vendor/vtracer/vtracer.wasm', import.meta.url));

function config(patch: Partial<VtracerConfig> = {}): VtracerConfig {
  return {
    binary: false,
    mode: 'spline',
    hierarchical: 'stacked',
    cornerThreshold: 60,
    lengthThreshold: 4,
    maxIterations: 10,
    spliceThreshold: 45,
    filterSpeckle: 10,
    colorPrecision: 6,
    layerDifference: 20,
    pathPrecision: 2,
    ...patch,
  };
}

function params(patch: Partial<TraceParams> = {}): TraceParams {
  return { ...DEFAULT_TRACE_PARAMS, ...patch };
}

function circleImage() {
  const width = 96;
  const height = 96;
  const data = new Uint8ClampedArray(width * height * 4);
  const cx = 48;
  const cy = 48;
  const radius = 30;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
        data[index] = 198;
        data[index + 1] = 42;
        data[index + 2] = 36;
        data[index + 3] = 255;
      }
    }
  }
  return { data, width, height };
}

function bwImage() {
  const width = 64;
  const height = 64;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 20; y < 45; y += 1) {
    for (let x = 20; x < 45; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
}

beforeAll(async () => {
  const bytes = new Uint8Array(readFileSync(wasmPath));
  await init({ module_or_path: bytes as InitInput });
});

describe('VTracer WASM integration', () => {
  it('traces transparent colour artwork into real paths without the key colour', () => {
    const source = circleImage();
    const prepared = prepareTraceImage(source, params());
    expect(prepared.keyColor).not.toBeNull();

    const svg = traceToSvg(prepared.pixels, source.width, source.height, config());
    expect(svg).toContain('<path');

    const parsed = parseVtracerSvg(svg, source.width, source.height, {
      keyColor: prepared.keyColor,
    });
    expect(parsed.paths.length).toBeGreaterThan(0);
    expect(parsed.stats.pathCount).toBe(parsed.paths.length);
    for (const path of parsed.paths) {
      expect(path.fill).not.toBe(prepared.keyColor?.toLowerCase());
      expect(path.fill).toMatch(/^#[0-9a-f]{6}$/);
      expect(path.d.startsWith('M')).toBe(true);
    }

    const document = buildSvgDocument(
      { width: source.width, height: source.height, paths: parsed.paths },
      { background: 'transparent', backgroundColor: '#ffffff' },
    );
    expect(document).toContain('viewBox="0 0 96 96"');
    expect(document).not.toContain(prepared.keyColor ?? 'never');
  });

  it('traces binary artwork in black-and-white mode', () => {
    const source = bwImage();
    const prepared = prepareTraceImage(source, params({ colorMode: 'bw' }));
    const svg = traceToSvg(
      prepared.pixels,
      source.width,
      source.height,
      config({ binary: true }),
    );
    const parsed = parseVtracerSvg(svg, source.width, source.height, { keyColor: null });

    expect(parsed.paths.length).toBeGreaterThan(0);
    expect(parsed.stats.colorCount).toBeLessThanOrEqual(2);
    for (const path of parsed.paths) {
      expect(['#000000', '#ffffff']).toContain(path.fill);
    }
  });

  it('produces curves in spline mode and straight segments in polygon mode', () => {
    const source = circleImage();
    const prepared = prepareTraceImage(source, params());
    const splineSvg = traceToSvg(
      prepared.pixels,
      source.width,
      source.height,
      config({ mode: 'spline' }),
    );
    const polygonSvg = traceToSvg(
      prepared.pixels,
      source.width,
      source.height,
      config({ mode: 'polygon' }),
    );

    const spline = parseVtracerSvg(splineSvg, source.width, source.height, {
      keyColor: prepared.keyColor,
    });
    const polygon = parseVtracerSvg(polygonSvg, source.width, source.height, {
      keyColor: prepared.keyColor,
    });

    expect(spline.paths.some((path) => /[Cc]/.test(path.d))).toBe(true);
    expect(polygon.paths.length).toBeGreaterThan(0);
    expect(polygon.paths.every((path) => !/[CcSsQqTt]/.test(path.d))).toBe(true);
  });

  it('honours the speckle filter on tiny noise', () => {
    const width = 80;
    const height = 80;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const place = (x: number, y: number) => {
      const index = (y * width + x) * 4;
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 255;
    };
    for (let i = 0; i < 4; i += 1) {
      place(4 + i * 7, 4);
      place(70, 60 + i * 3);
    }
    for (let y = 30; y < 45; y += 1) {
      for (let x = 30; x < 45; x += 1) place(x, y);
    }

    const prepared = prepareTraceImage({ data, width, height }, params({ colorMode: 'bw' }));
    const strong = traceToSvg(prepared.pixels, width, height, config({ binary: true, filterSpeckle: 64 }));
    const weak = traceToSvg(prepared.pixels, width, height, config({ binary: true, filterSpeckle: 0 }));
    const strongParsed = parseVtracerSvg(strong, width, height, { keyColor: null });
    const weakParsed = parseVtracerSvg(weak, width, height, { keyColor: null });

    expect(strongParsed.stats.pathCount).toBeLessThanOrEqual(weakParsed.stats.pathCount);
    expect(weakParsed.paths.length).toBeGreaterThan(0);
  });
});
