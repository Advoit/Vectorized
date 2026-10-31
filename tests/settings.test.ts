import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_TRACE_PARAMS,
  isGroupDefault,
  matchingPreset,
  PARAM_RANGES,
  PRESETS,
  resetParamsGroup,
  sanitizePreferences,
  sanitizeTraceParams,
  traceParamsEqual,
  traceSignature,
  workingDimensions,
} from '../src/trace/settings';

describe('engine parameter bounds', () => {
  it('keeps colour precision inside the range supported by the WASM build', () => {
    // Five or more bits make the bundled build merge every colour into one layer.
    expect(PARAM_RANGES.colorPrecision.max).toBe(4);
    expect(sanitizeTraceParams({ colorPrecision: 8 }).colorPrecision).toBe(4);
    expect(sanitizeTraceParams({ colorPrecision: 0 }).colorPrecision).toBe(1);
  });
});

describe('sanitizeTraceParams', () => {
  it('falls back to defaults for missing or malformed input', () => {
    expect(sanitizeTraceParams(null)).toEqual(DEFAULT_TRACE_PARAMS);
    expect(sanitizeTraceParams('nope')).toEqual(DEFAULT_TRACE_PARAMS);
    expect(sanitizeTraceParams({ colorMode: 'sepia', curveMode: 'pixel' })).toEqual(
      DEFAULT_TRACE_PARAMS,
    );
  });

  it('clamps and steps numeric values instead of trusting storage', () => {
    const params = sanitizeTraceParams({
      colorPrecision: 99,
      layerDifference: -20,
      filterSpeckle: 900,
      lengthThreshold: 3.24,
      cornerThreshold: 360,
      spliceThreshold: -4,
      maxIterations: 0.2,
      backgroundTolerance: 140,
      curveMode: 'polygon',
      colorMode: 'bw',
    });

    expect(params.colorPrecision).toBe(4);
    expect(params.layerDifference).toBe(0);
    expect(params.filterSpeckle).toBe(128);
    expect(params.lengthThreshold).toBe(3);
    expect(params.cornerThreshold).toBe(180);
    expect(params.spliceThreshold).toBe(0);
    expect(params.maxIterations).toBe(1);
    expect(params.backgroundTolerance).toBe(100);
    expect(params.curveMode).toBe('polygon');
    expect(params.colorMode).toBe('bw');
  });

  it('ignores non-numeric and non-boolean values', () => {
    const params = sanitizeTraceParams({
      colorPrecision: '6',
      removeBackground: 'yes',
      backgroundTolerance: Number.NaN,
    });
    expect(params.colorPrecision).toBe(DEFAULT_TRACE_PARAMS.colorPrecision);
    expect(params.removeBackground).toBe(false);
    expect(params.backgroundTolerance).toBe(DEFAULT_TRACE_PARAMS.backgroundTolerance);
  });
});

describe('sanitizePreferences', () => {
  it('accepts only known modes and resolutions', () => {
    expect(
      sanitizePreferences({
        background: 'green',
        backgroundColor: 'not-a-colour',
        workingResolution: 1234,
        previewBackground: 'neon',
      }),
    ).toEqual(DEFAULT_PREFERENCES);

    expect(
      sanitizePreferences({
        background: 'custom',
        backgroundColor: '#AABBCC',
        workingResolution: 0,
        previewBackground: 'dark',
        autoTrace: true,
        showContours: true,
      }),
    ).toEqual({
      background: 'custom',
      backgroundColor: '#aabbcc',
      workingResolution: 0,
      previewBackground: 'dark',
      autoTrace: true,
      showContours: true,
    });
  });
});

describe('trace signatures', () => {
  it('are stable for equal input', () => {
    const first = traceSignature(DEFAULT_TRACE_PARAMS, 'image-a', 800, 600);
    const second = traceSignature({ ...DEFAULT_TRACE_PARAMS }, 'image-a', 800, 600);
    expect(first).toBe(second);
  });

  it('change when geometry-relevant parameters change', () => {
    const base = traceSignature(DEFAULT_TRACE_PARAMS, 'image-a', 800, 600);
    const variants = [
      traceSignature({ ...DEFAULT_TRACE_PARAMS, colorPrecision: 3 }, 'image-a', 800, 600),
      traceSignature({ ...DEFAULT_TRACE_PARAMS, removeBackground: true }, 'image-a', 800, 600),
      traceSignature({ ...DEFAULT_TRACE_PARAMS, curveMode: 'spline' }, 'image-a', 800, 600),
      traceSignature(DEFAULT_TRACE_PARAMS, 'image-b', 800, 600),
      traceSignature(DEFAULT_TRACE_PARAMS, 'image-a', 799, 600),
    ];
    for (const variant of variants) {
      expect(variant).not.toBe(base);
    }
  });
});

describe('presets and resets', () => {
  it('recognises each shipped preset and rejects modified values', () => {
    for (const preset of PRESETS) {
      expect(matchingPreset(preset.params)).toBe(preset.id);
    }
    expect(
      matchingPreset({ ...PRESETS[0]!.params, filterSpeckle: DEFAULT_TRACE_PARAMS.filterSpeckle + 1 }),
    ).toBeNull();
  });

  it('resets one group without touching the others', () => {
    const custom = {
      ...DEFAULT_TRACE_PARAMS,
      colorMode: 'bw' as const,
      colorPrecision: 3,
      filterSpeckle: 44,
      curveMode: 'spline' as const,
      maxIterations: 2,
      removeBackground: true,
      backgroundTolerance: 70,
    };

    const form = resetParamsGroup(custom, 'form');
    expect(form.colorPrecision).toBe(DEFAULT_TRACE_PARAMS.colorPrecision);
    expect(form.filterSpeckle).toBe(DEFAULT_TRACE_PARAMS.filterSpeckle);
    expect(form.colorMode).toBe('bw');
    expect(form.curveMode).toBe('spline');
    expect(form.removeBackground).toBe(true);

    const advanced = resetParamsGroup(custom, 'advanced');
    expect(advanced.curveMode).toBe(DEFAULT_TRACE_PARAMS.curveMode);
    expect(advanced.maxIterations).toBe(DEFAULT_TRACE_PARAMS.maxIterations);
    expect(advanced.filterSpeckle).toBe(44);

    const preprocess = resetParamsGroup(custom, 'preprocess');
    expect(preprocess.removeBackground).toBe(false);
    expect(preprocess.backgroundTolerance).toBe(DEFAULT_TRACE_PARAMS.backgroundTolerance);
    expect(preprocess.filterSpeckle).toBe(44);

    const mode = resetParamsGroup(custom, 'mode');
    expect(mode.colorMode).toBe('color');
    expect(mode.colorPrecision).toBe(DEFAULT_TRACE_PARAMS.colorPrecision);
    expect(mode.curveMode).toBe('spline');

    expect(resetParamsGroup(custom, 'all')).toEqual(DEFAULT_TRACE_PARAMS);
  });

  it('reports whether a group differs from defaults', () => {
    expect(isGroupDefault(DEFAULT_TRACE_PARAMS, 'form')).toBe(true);
    expect(isGroupDefault(DEFAULT_TRACE_PARAMS, 'advanced')).toBe(true);
    expect(isGroupDefault(DEFAULT_TRACE_PARAMS, 'preprocess')).toBe(true);
    expect(isGroupDefault(DEFAULT_TRACE_PARAMS, 'mode')).toBe(true);
    expect(
      isGroupDefault({ ...DEFAULT_TRACE_PARAMS, filterSpeckle: 1 }, 'form'),
    ).toBe(false);
    expect(
      isGroupDefault({ ...DEFAULT_TRACE_PARAMS, colorPrecision: 2 }, 'form'),
    ).toBe(false);
    expect(
      isGroupDefault({ ...DEFAULT_TRACE_PARAMS, colorPrecision: 2 }, 'mode'),
    ).toBe(false);
  });

  it('compares all tracing parameters', () => {
    expect(traceParamsEqual(DEFAULT_TRACE_PARAMS, { ...DEFAULT_TRACE_PARAMS })).toBe(true);
    expect(
      traceParamsEqual(DEFAULT_TRACE_PARAMS, {
        ...DEFAULT_TRACE_PARAMS,
        backgroundTolerance: 1,
      }),
    ).toBe(false);
  });
});

describe('workingDimensions', () => {
  it('never enlarges a small source', () => {
    expect(workingDimensions(300, 200, 2400)).toEqual({ width: 300, height: 200, scale: 1 });
  });

  it('scales the longest edge to the requested limit', () => {
    expect(workingDimensions(4800, 2400, 2400)).toEqual({
      width: 2400,
      height: 1200,
      scale: 0.5,
    });
    expect(workingDimensions(1000, 5000, 2500)).toEqual({
      width: 500,
      height: 2500,
      scale: 0.5,
    });
  });

  it('uses the original resolution when the limit is zero', () => {
    expect(workingDimensions(9000, 4500, 0)).toEqual({
      width: 9000,
      height: 4500,
      scale: 1,
    });
  });

  it('keeps both dimensions at least one pixel', () => {
    const result = workingDimensions(10_000, 1, 100);
    expect(result.width).toBe(100);
    expect(result.height).toBe(1);
  });
});
