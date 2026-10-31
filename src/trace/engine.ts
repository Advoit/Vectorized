import type { TraceParams } from './types';
import type { TracePrepareInfo, TraceWorkerRequest, TraceWorkerResponse } from './protocol';

export interface TraceWorkerResult {
  svg: string;
  elapsedMs: number;
  prepare: TracePrepareInfo;
}

export interface StartTraceOptions {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  params: TraceParams;
  requestId: number;
  signal: AbortSignal;
  onPhase: (phase: 'preparing' | 'tracing' | 'finalizing') => void;
}

/**
 * Runs one trace in a dedicated module worker. Terminating the worker is the
 * only reliable way to cancel the synchronous WASM tracing call, so every job
 * owns its worker.
 */
export function traceInWorker(options: StartTraceOptions): Promise<TraceWorkerResult> {
  return new Promise((resolve, reject) => {
    if (options.signal.aborted) {
      reject(new DOMException('Abgebrochen', 'AbortError'));
      return;
    }

    const worker = new Worker(new URL('./trace.worker.ts', import.meta.url), {
      type: 'module',
      name: 'kontur-tracer',
    });
    let settled = false;

    const cleanup = () => {
      options.signal.removeEventListener('abort', abort);
      worker.terminate();
    };

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };

    const abort = () => {
      finish(() => reject(new DOMException('Abgebrochen', 'AbortError')));
    };

    options.signal.addEventListener('abort', abort, { once: true });

    worker.onmessage = (event: MessageEvent<TraceWorkerResponse>) => {
      const message = event.data;
      if (!message || message.requestId !== options.requestId) return;

      if (message.type === 'phase') {
        options.onPhase(message.phase);
        return;
      }

      if (message.type === 'result') {
        finish(() =>
          resolve({
            svg: message.svg,
            elapsedMs: message.elapsedMs,
            prepare: message.prepare,
          }),
        );
        return;
      }

      finish(() => reject(new Error(message.message)));
    };

    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || 'Web-Worker-Fehler')));
    };

    const request: TraceWorkerRequest = {
      type: 'trace',
      requestId: options.requestId,
      width: options.width,
      height: options.height,
      pixels: options.pixels,
      params: options.params,
    };

    worker.postMessage(request, [options.pixels.buffer as ArrayBuffer]);
  });
}
