import init, { to_svg } from './vtracer';

/** Typed surface for the vendored VTracer 0.1.0 WASM build. */
export interface VtracerConfig {
  binary: boolean;
  mode: 'spline' | 'polygon' | 'pixel';
  hierarchical: 'stacked' | 'cutout';
  cornerThreshold: number;
  lengthThreshold: number;
  maxIterations: number;
  spliceThreshold: number;
  filterSpeckle: number;
  colorPrecision: number;
  layerDifference: number;
  pathPrecision: number;
}

export function traceToSvg(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  config: VtracerConfig,
): string {
  const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  return to_svg(bytes, width, height, config);
}

export async function initVtracer(wasmUrl: string): Promise<void> {
  await init({ module_or_path: wasmUrl });
}
