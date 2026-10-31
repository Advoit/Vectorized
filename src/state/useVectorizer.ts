import { useCallback, useEffect, useRef, useState } from 'react';
import { de } from '../i18n/de';
import { extractWorkingCopy, type SourceImage, type WorkingCopy } from '../image/load';
import { traceInWorker } from '../trace/engine';
import { parseVtracerSvg } from '../trace/postprocess';
import { traceSignature, workingDimensions } from '../trace/settings';
import type { JobState, Preferences, TraceParams, TraceResult } from '../trace/types';

interface UseVectorizerOptions {
  source: SourceImage | null;
  params: TraceParams;
  preferences: Preferences;
  onSuccess?: (result: TraceResult) => void;
}

export interface VectorizerApi {
  result: TraceResult | null;
  job: JobState;
  error: string | null;
  busy: boolean;
  trace: () => Promise<TraceResult | null>;
  cancel: () => void;
  clearError: () => void;
}

const IDLE_JOB: JobState = { phase: 'idle', startedAt: null, error: null };

function friendlyWorkerError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/wasm|webassembly|fetch|import|module/i.test(message)) {
    return de.errors.wasmFailed;
  }
  return de.errors.workerFailed;
}

export function useVectorizer(options: UseVectorizerOptions): VectorizerApi {
  const { source, params, preferences } = options;
  const [result, setResult] = useState<TraceResult | null>(null);
  const [job, setJob] = useState<JobState>(IDLE_JOB);
  const [error, setError] = useState<string | null>(null);

  const sourceRef = useRef<SourceImage | null>(source);
  const paramsRef = useRef(params);
  const resolutionRef = useRef(preferences.workingResolution);
  const successRef = useRef(options.onSuccess);
  const workingRef = useRef<(WorkingCopy & { key: string }) | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const activeRequest = useRef(0);

  sourceRef.current = source;
  paramsRef.current = params;
  resolutionRef.current = preferences.workingResolution;
  successRef.current = options.onSuccess;

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    activeRequest.current += 1;
    workingRef.current = null;
    setResult(null);
    setJob(IDLE_JOB);
    setError(null);
  }, [source?.id]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    },
    [],
  );

  const cancel = useCallback(() => {
    activeRequest.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setJob((current) => (current.phase === 'idle' ? current : IDLE_JOB));
  }, []);

  const trace = useCallback(async (): Promise<TraceResult | null> => {
    const currentSource = sourceRef.current;
    if (!currentSource) return null;

    activeRequest.current += 1;
    const requestId = activeRequest.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const paramsSnapshot = paramsRef.current;
    const resolution = resolutionRef.current;

    setError(null);
    setJob({ phase: 'preparing', startedAt: Date.now(), error: null });

    try {
      const key = `${currentSource.id}:${resolution}`;
      let working = workingRef.current;
      if (!working || working.key !== key) {
        const copy = await extractWorkingCopy(currentSource, resolution);
        if (controller.signal.aborted) return null;
        working = { ...copy, key };
        workingRef.current = working;
      }

      const pixels = new Uint8ClampedArray(working.data.data);
      const workerResult = await traceInWorker({
        pixels,
        width: working.width,
        height: working.height,
        params: paramsSnapshot,
        requestId,
        signal: controller.signal,
        onPhase: (phase) => {
          if (requestId !== activeRequest.current) return;
          setJob((current) => ({ ...current, phase }));
        },
      });

      if (controller.signal.aborted || requestId !== activeRequest.current) return null;
      setJob((current) => ({ ...current, phase: 'finalizing' }));

      const parsed = parseVtracerSvg(workerResult.svg, working.width, working.height, {
        keyColor: workerResult.prepare.keyColor,
      });

      if (parsed.paths.length === 0) {
        setJob(IDLE_JOB);
        setError(de.errors.noPaths);
        return null;
      }

      const traceResult: TraceResult = {
        id: requestId,
        imageId: currentSource.id,
        width: working.width,
        height: working.height,
        paths: parsed.paths,
        stats: parsed.stats,
        paramsSignature: traceSignature(
          paramsSnapshot,
          currentSource.id,
          working.width,
          working.height,
        ),
        elapsedMs: workerResult.elapsedMs,
        hadTransparency: workerResult.prepare.hadTransparency,
        backgroundRemoved: workerResult.prepare.backgroundRemovedPixels > 0,
        sourceColorEstimate: workerResult.prepare.sourceColorEstimate,
      };

      if (requestId !== activeRequest.current) return null;

      setResult(traceResult);
      setJob(IDLE_JOB);
      setError(null);
      successRef.current?.(traceResult);
      return traceResult;
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        return null;
      }
      const message = friendlyWorkerError(caught);
      setJob(IDLE_JOB);
      setError(message);
      return null;
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, []);

  return {
    result,
    job,
    error,
    busy: job.phase !== 'idle',
    trace,
    cancel,
    clearError: () => setError(null),
  };
}

export function expectedWorkingDimensions(
  source: SourceImage | null,
  maxDimension: number,
): { width: number; height: number } | null {
  if (!source) return null;
  const dimensions = workingDimensions(source.width, source.height, maxDimension);
  return { width: dimensions.width, height: dimensions.height };
}
