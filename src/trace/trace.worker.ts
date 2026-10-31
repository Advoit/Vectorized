import wasmUrl from '../vendor/vtracer/vtracer.wasm?url';
import { initVtracer, traceToSvg } from '../vendor/vtracer';
import { prepareTraceImage } from './preprocess';
import { PARAM_RANGES } from './settings';
import type { TraceWorkerRequest, TraceWorkerResponse } from './protocol';

interface WorkerScope {
  onmessage: ((event: MessageEvent<TraceWorkerRequest>) => void) | null;
  postMessage: (message: TraceWorkerResponse) => void;
}

const scope = self as unknown as WorkerScope;

let wasmReady: Promise<void> | null = null;

function ensureEngine(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initVtracer(wasmUrl);
  }
  return wasmReady;
}

scope.onmessage = (event: MessageEvent<TraceWorkerRequest>) => {
  const request = event.data;
  if (!request || request.type !== 'trace') return;

  void (async () => {
    const startedAt = performance.now();
    try {
      scope.postMessage({ type: 'phase', requestId: request.requestId, phase: 'preparing' });

      if (request.pixels.length !== request.width * request.height * 4) {
        throw new Error('Ungültige Bilddaten.');
      }

      const prepared = prepareTraceImage(
        { data: request.pixels, width: request.width, height: request.height },
        request.params,
      );

      scope.postMessage({ type: 'phase', requestId: request.requestId, phase: 'tracing' });
      await ensureEngine();

      const svg = traceToSvg(prepared.pixels, request.width, request.height, {
        binary: request.params.colorMode === 'bw',
        mode: request.params.curveMode,
        hierarchical: 'stacked',
        cornerThreshold: request.params.cornerThreshold,
        lengthThreshold: request.params.lengthThreshold,
        maxIterations: request.params.maxIterations,
        spliceThreshold: request.params.spliceThreshold,
        filterSpeckle: request.params.filterSpeckle,
        colorPrecision: Math.min(
          PARAM_RANGES.colorPrecision.max,
          Math.max(PARAM_RANGES.colorPrecision.min, request.params.colorPrecision),
        ),
        layerDifference: request.params.layerDifference,
        pathPrecision: 2,
      });

      scope.postMessage({ type: 'phase', requestId: request.requestId, phase: 'finalizing' });
      scope.postMessage({
        type: 'result',
        requestId: request.requestId,
        svg,
        elapsedMs: Math.round(performance.now() - startedAt),
        prepare: {
          hadTransparency: prepared.hadTransparency,
          backgroundRemovedPixels: prepared.backgroundRemovedPixels,
          sourceColorEstimate: prepared.sourceColorEstimate,
          keyColor: prepared.keyColor,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Keep the detail in the worker console for debugging; the UI shows a
      // friendly, actionable message.
      console.error('Tracing failed:', error);
      scope.postMessage({ type: 'error', requestId: request.requestId, message });
    }
  })();
};
