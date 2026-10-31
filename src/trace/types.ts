export type ColorMode = 'color' | 'bw';
export type CurveMode = 'spline' | 'polygon';
export type BackgroundMode = 'transparent' | 'white' | 'custom';
export type PreviewBackground = 'checker' | 'light' | 'dark';
export type ViewMode = 'original' | 'compare' | 'vector';
export type JobPhase = 'idle' | 'preparing' | 'tracing' | 'finalizing';

/** Parameters that affect the traced geometry. */
export interface TraceParams {
  colorMode: ColorMode;
  /** Significant bits per RGB channel understood by VTracer (1–6). */
  colorPrecision: number;
  /** Colour difference between gradient layers (0–64). */
  layerDifference: number;
  /** Minimum cluster area in px² (0–128). */
  filterSpeckle: number;
  /** Curve fitting segment length (0.5–10). */
  lengthThreshold: number;
  /** Corner detection threshold (0–180). */
  cornerThreshold: number;
  /** Splice threshold (0–90). */
  spliceThreshold: number;
  curveMode: CurveMode;
  /** Hidden fine-tuning value; kept explicit for reproducible results. */
  maxIterations: number;
  /** Remove the connected background sampled from the image border. */
  removeBackground: boolean;
  /** 0–100, mapped to an RGB distance for background removal. */
  backgroundTolerance: number;
}

/** Presentation and session preferences. Never part of the undo history. */
export interface Preferences {
  background: BackgroundMode;
  backgroundColor: string;
  /** 0 means the original resolution. */
  workingResolution: number;
  autoTrace: boolean;
  previewBackground: PreviewBackground;
  showContours: boolean;
}

export interface TracedPath {
  d: string;
  fill: string;
  transform?: string;
}

export interface TraceStats {
  pathCount: number;
  subpathCount: number;
  colorCount: number;
  bytes: number;
}

export interface TraceResult {
  id: number;
  imageId: string;
  width: number;
  height: number;
  paths: TracedPath[];
  stats: TraceStats;
  paramsSignature: string;
  elapsedMs: number;
  hadTransparency: boolean;
  backgroundRemoved: boolean;
  /** Unique quantized colours in the working image, used for the photo hint. */
  sourceColorEstimate: number;
}

export interface JobState {
  phase: JobPhase;
  startedAt: number | null;
  error: string | null;
}

export interface PrepareResult {
  pixels: Uint8ClampedArray;
  keyColor: string | null;
  hadTransparency: boolean;
  backgroundRemovedPixels: number;
  sourceColorEstimate: number;
}
