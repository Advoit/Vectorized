import type { TraceParams } from './types';

export interface TraceWorkerRequest {
  type: 'trace';
  requestId: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  params: TraceParams;
}

export interface TracePrepareInfo {
  hadTransparency: boolean;
  backgroundRemovedPixels: number;
  sourceColorEstimate: number;
  keyColor: string | null;
}

export type TraceWorkerResponse =
  | { type: 'phase'; requestId: number; phase: 'preparing' | 'tracing' | 'finalizing' }
  | {
      type: 'result';
      requestId: number;
      svg: string;
      elapsedMs: number;
      prepare: TracePrepareInfo;
    }
  | { type: 'error'; requestId: number; message: string };
