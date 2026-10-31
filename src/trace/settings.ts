import type { Preferences, TraceParams } from './types';

type NumericRange = { min: number; max: number; step: number };

export const PARAM_RANGES = {
  /*
   * Measured against the vendored VTracer 0.1.0 WASM build: colour layers
   * collapse as soon as the bit depth is high enough. An 8-colour stripe image
   * yields eight paths at 4 bits but a single averaged path at 5; a logo with
   * four colours stays intact up to 5 bits and collapses to two paths at 6.
   * Four is the highest value that kept the colour structure in every
   * measurement, so the UI stops there.
   */
  colorPrecision: { min: 1, max: 4, step: 1 },
  layerDifference: { min: 0, max: 64, step: 1 },
  filterSpeckle: { min: 0, max: 128, step: 1 },
  lengthThreshold: { min: 0.5, max: 10, step: 0.5 },
  cornerThreshold: { min: 0, max: 180, step: 1 },
  spliceThreshold: { min: 0, max: 90, step: 1 },
  maxIterations: { min: 1, max: 20, step: 1 },
  backgroundTolerance: { min: 0, max: 100, step: 1 },
} as const satisfies Record<string, NumericRange>;

export const DEFAULT_TRACE_PARAMS: TraceParams = {
  colorMode: 'color',
  colorPrecision: 4,
  layerDifference: 20,
  filterSpeckle: 10,
  lengthThreshold: 4,
  cornerThreshold: 60,
  spliceThreshold: 45,
  /*
   * The bundled build's spline fitting displaces geometry by tens of pixels
   * (a 160x60 rectangle becomes a 23x75 lens, 68 px off), while polygon output
   * is pixel-exact. Polygons are therefore the default and the only curve mode
   * the UI offers.
   */
  curveMode: 'polygon',
  maxIterations: 10,
  removeBackground: false,
  backgroundTolerance: 22,
};

export const DEFAULT_PREFERENCES: Preferences = {
  background: 'transparent',
  backgroundColor: '#ffffff',
  workingResolution: 2400,
  autoTrace: false,
  previewBackground: 'checker',
  showContours: false,
};

export interface Preset {
  id: 'logo' | 'illustration' | 'bw';
  params: TraceParams;
}

/** Presets only contain values that genuinely reach the tracing pipeline. */
export const PRESETS: readonly Preset[] = [
  {
    id: 'logo',
    params: { ...DEFAULT_TRACE_PARAMS },
  },
  {
    id: 'illustration',
    params: {
      ...DEFAULT_TRACE_PARAMS,
      colorPrecision: 4,
      layerDifference: 12,
      filterSpeckle: 4,
      lengthThreshold: 3.5,
      cornerThreshold: 45,
    },
  },
  {
    id: 'bw',
    params: {
      ...DEFAULT_TRACE_PARAMS,
      colorMode: 'bw',
      colorPrecision: 4,
      layerDifference: 16,
      filterSpeckle: 6,
      lengthThreshold: 3.5,
      cornerThreshold: 75,
    },
  },
];

export const WORKING_RESOLUTIONS = [1200, 1600, 2400, 3200, 0] as const;

export const FORM_KEYS = [
  'colorPrecision',
  'layerDifference',
  'filterSpeckle',
  'lengthThreshold',
] as const;

export const ADVANCED_KEYS = [
  'cornerThreshold',
  'spliceThreshold',
  'curveMode',
  'maxIterations',
] as const;

export const PREPROCESS_KEYS = ['removeBackground', 'backgroundTolerance'] as const;

function clampNumber(value: unknown, range: NumericRange, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const stepped = Math.round((clamped - range.min) / range.step) * range.step + range.min;
  return Number(Math.min(range.max, Math.max(range.min, stepped)).toFixed(4));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function sanitizeTraceParams(input: unknown): TraceParams {
  const raw = isRecord(input) ? input : {};
  return {
    colorMode: raw.colorMode === 'bw' ? 'bw' : 'color',
    colorPrecision: clampNumber(
      raw.colorPrecision,
      PARAM_RANGES.colorPrecision,
      DEFAULT_TRACE_PARAMS.colorPrecision,
    ),
    layerDifference: clampNumber(
      raw.layerDifference,
      PARAM_RANGES.layerDifference,
      DEFAULT_TRACE_PARAMS.layerDifference,
    ),
    filterSpeckle: clampNumber(
      raw.filterSpeckle,
      PARAM_RANGES.filterSpeckle,
      DEFAULT_TRACE_PARAMS.filterSpeckle,
    ),
    lengthThreshold: clampNumber(
      raw.lengthThreshold,
      PARAM_RANGES.lengthThreshold,
      DEFAULT_TRACE_PARAMS.lengthThreshold,
    ),
    cornerThreshold: clampNumber(
      raw.cornerThreshold,
      PARAM_RANGES.cornerThreshold,
      DEFAULT_TRACE_PARAMS.cornerThreshold,
    ),
    spliceThreshold: clampNumber(
      raw.spliceThreshold,
      PARAM_RANGES.spliceThreshold,
      DEFAULT_TRACE_PARAMS.spliceThreshold,
    ),
    // Stored or manipulated values are clamped to polygons: the bundled spline
    // fitting produces displaced geometry, so it is never used.
    curveMode: 'polygon',
    maxIterations: clampNumber(
      raw.maxIterations,
      PARAM_RANGES.maxIterations,
      DEFAULT_TRACE_PARAMS.maxIterations,
    ),
    removeBackground: raw.removeBackground === true,
    backgroundTolerance: clampNumber(
      raw.backgroundTolerance,
      PARAM_RANGES.backgroundTolerance,
      DEFAULT_TRACE_PARAMS.backgroundTolerance,
    ),
  };
}

export function sanitizePreferences(input: unknown): Preferences {
  const raw = isRecord(input) ? input : {};
  const background =
    raw.background === 'white' || raw.background === 'custom' ? raw.background : 'transparent';
  const previewBackground =
    raw.previewBackground === 'light' || raw.previewBackground === 'dark'
      ? raw.previewBackground
      : 'checker';
  const resolution =
    typeof raw.workingResolution === 'number' && (WORKING_RESOLUTIONS as readonly number[]).includes(raw.workingResolution)
      ? raw.workingResolution
      : DEFAULT_PREFERENCES.workingResolution;

  return {
    background,
    backgroundColor: isValidHexColor(raw.backgroundColor)
      ? raw.backgroundColor.toLowerCase()
      : DEFAULT_PREFERENCES.backgroundColor,
    workingResolution: resolution,
    autoTrace: raw.autoTrace === true,
    previewBackground,
    showContours: raw.showContours === true,
  };
}

export function traceParamsEqual(a: TraceParams, b: TraceParams): boolean {
  return (
    a.colorMode === b.colorMode &&
    a.colorPrecision === b.colorPrecision &&
    a.layerDifference === b.layerDifference &&
    a.filterSpeckle === b.filterSpeckle &&
    a.lengthThreshold === b.lengthThreshold &&
    a.cornerThreshold === b.cornerThreshold &&
    a.spliceThreshold === b.spliceThreshold &&
    a.curveMode === b.curveMode &&
    a.maxIterations === b.maxIterations &&
    a.removeBackground === b.removeBackground &&
    a.backgroundTolerance === b.backgroundTolerance
  );
}

/**
 * A stable fingerprint of everything that defines the traced geometry for an
 * image. If this changes, an existing result is stale.
 */
export function traceSignature(
  params: TraceParams,
  imageId: string,
  workingWidth: number,
  workingHeight: number,
): string {
  return [
    imageId,
    workingWidth,
    workingHeight,
    params.colorMode,
    params.colorPrecision,
    params.layerDifference,
    params.filterSpeckle,
    params.lengthThreshold,
    params.cornerThreshold,
    params.spliceThreshold,
    params.curveMode,
    params.maxIterations,
    params.removeBackground ? 1 : 0,
    params.backgroundTolerance,
  ].join('|');
}

export function matchingPreset(params: TraceParams): Preset['id'] | null {
  const match = PRESETS.find((preset) => traceParamsEqual(preset.params, params));
  return match?.id ?? null;
}

export function resetParamsGroup(
  params: TraceParams,
  group: 'all' | 'form' | 'advanced' | 'preprocess' | 'mode',
): TraceParams {
  if (group === 'all') return { ...DEFAULT_TRACE_PARAMS };
  const next: TraceParams = { ...params };
  if (group === 'mode') {
    next.colorMode = DEFAULT_TRACE_PARAMS.colorMode;
    next.colorPrecision = DEFAULT_TRACE_PARAMS.colorPrecision;
  }
  if (group === 'form') {
    next.colorPrecision = DEFAULT_TRACE_PARAMS.colorPrecision;
    next.layerDifference = DEFAULT_TRACE_PARAMS.layerDifference;
    next.filterSpeckle = DEFAULT_TRACE_PARAMS.filterSpeckle;
    next.lengthThreshold = DEFAULT_TRACE_PARAMS.lengthThreshold;
  }
  if (group === 'advanced') {
    next.cornerThreshold = DEFAULT_TRACE_PARAMS.cornerThreshold;
    next.spliceThreshold = DEFAULT_TRACE_PARAMS.spliceThreshold;
    next.curveMode = DEFAULT_TRACE_PARAMS.curveMode;
    next.maxIterations = DEFAULT_TRACE_PARAMS.maxIterations;
  }
  if (group === 'preprocess') {
    next.removeBackground = DEFAULT_TRACE_PARAMS.removeBackground;
    next.backgroundTolerance = DEFAULT_TRACE_PARAMS.backgroundTolerance;
  }
  return next;
}

export function isGroupDefault(
  params: TraceParams,
  group: 'form' | 'advanced' | 'preprocess' | 'mode',
): boolean {
  const defaults = DEFAULT_TRACE_PARAMS;
  if (group === 'mode') {
    return (
      params.colorMode === defaults.colorMode && params.colorPrecision === defaults.colorPrecision
    );
  }
  const keys = group === 'form' ? FORM_KEYS : group === 'advanced' ? ADVANCED_KEYS : PREPROCESS_KEYS;
  return keys.every((key) => params[key] === defaults[key]);
}

export function resolutionLabel(value: number): string {
  return value === 0 ? 'Original' : `${value} px`;
}

/**
 * Scale used for the working copy. Never enlarges the source.
 */
export function workingDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number; scale: number } {
  if (maxDimension <= 0 || Math.max(width, height) <= maxDimension) {
    return { width, height, scale: 1 };
  }
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}
