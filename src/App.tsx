import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconUpload } from '@tabler/icons-react';
import { AboutDialog } from './components/AboutDialog';
import { EmptyState } from './components/EmptyState';
import { ExportDialog } from './components/ExportDialog';
import { Header } from './components/Header';
import { PrivacyNotice } from './components/PrivacyNotice';
import { Sidebar } from './components/Sidebar';
import { ToastViewport } from './components/ToastViewport';
import { Viewer, type ViewerHandle } from './components/Viewer';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useLocale, useMessages, useNumberFormat, type Messages } from './i18n';
import {
  disposeSource,
  ImageLoadError,
  loadSourceImage,
  type SourceImage,
} from './image/load';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_TRACE_PARAMS,
  resetParamsGroup,
  traceParamsEqual,
  traceSignature,
  type Preset,
} from './trace/settings';
import type { Preferences, TraceParams, TraceResult, ViewMode } from './trace/types';
import { formatCount } from './trace/postprocess';
import {
  readStoredParams,
  readStoredPreferences,
  writeStoredParams,
  writeStoredPreferences,
} from './state/storage';
import { useShortcuts } from './state/useShortcuts';
import { useToasts } from './state/useToasts';
import { useTraceHistory } from './state/useTraceHistory';
import { expectedWorkingDimensions, useVectorizer } from './state/useVectorizer';

function importErrorMessage(error: unknown, m: Messages): string {
  if (error instanceof ImageLoadError) {
    switch (error.code) {
      case 'invalidType':
        return m.errors.invalidType;
      case 'svgNotSupported':
        return m.errors.svgNotSupported;
      case 'fileTooLarge':
        return m.errors.fileTooLarge;
      case 'tooManyPixels':
        return m.errors.tooManyPixels;
      case 'decodeFailed':
        return m.errors.decodeFailed;
      case 'emptyPixels':
        return m.errors.emptyPixels;
    }
  }
  return m.errors.decodeFailed;
}

function hasFilePayload(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

export default function App() {
  const [initialParams] = useState<TraceParams>(() => readStoredParams());
  const [preferences, setPreferences] = useState<Preferences>(() => readStoredPreferences());
  const [source, setSource] = useState<SourceImage | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('original');
  const [exportOpen, setExportOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const history = useTraceHistory(initialParams);
  const toasts = useToasts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<ViewerHandle>(null);
  const autoSuppressedRef = useRef<string | null>(null);
  const clipboardReadRef = useRef<'idle' | 'pending' | 'done' | 'failed'>('idle');
  const pasteDeliveredRef = useRef(0);
  const autoStateRef = useRef<{ key: string; status: 'scheduled' | 'running' | 'done' | 'failed' }>({
    key: '',
    status: 'done',
  });
  const manualTraceRef = useRef(true);
  const isMobile = useMediaQuery('(max-width: 860px)');
  const m = useMessages();
  const { locale } = useLocale();
  const { decimal } = useNumberFormat();

  const handleTraceSuccess = useCallback(
    (result: TraceResult) => {
      if (manualTraceRef.current) {
        toasts.show(
          m.toasts.traced(
            formatCount(result.stats.pathCount, locale),
            decimal(result.elapsedMs / 1000),
          ),
          'success',
        );
      }
      setViewMode((current) => (current === 'original' ? 'compare' : current));
    },
    [decimal, locale, m, toasts],
  );

  const vectorizer = useVectorizer({
    source,
    params: history.params,
    preferences,
    onSuccess: handleTraceSuccess,
  });

  const currentResult =
    vectorizer.result && source && vectorizer.result.imageId === source.id
      ? vectorizer.result
      : null;

  const expectedDimensions = useMemo(
    () => expectedWorkingDimensions(source, preferences.workingResolution),
    [preferences.workingResolution, source],
  );

  const currentSignature = useMemo(() => {
    if (!source || !expectedDimensions) return '';
    return traceSignature(
      history.params,
      source.id,
      expectedDimensions.width,
      expectedDimensions.height,
    );
  }, [expectedDimensions, history.params, source]);

  const stale = Boolean(currentResult && currentSignature && currentResult.paramsSignature !== currentSignature);
  const busy = vectorizer.busy;

  useEffect(() => {
    const timer = window.setTimeout(() => writeStoredParams(history.params), 300);
    return () => window.clearTimeout(timer);
  }, [history.params]);

  useEffect(() => {
    const timer = window.setTimeout(() => writeStoredPreferences(preferences), 300);
    return () => window.clearTimeout(timer);
  }, [preferences]);

  useEffect(() => {
    return () => disposeSource(source);
  }, [source]);

  useEffect(() => {
    document.title = source ? `${source.name} – ${m.product.name}` : m.product.title;
  }, [m, source]);

  useEffect(() => {
    if (!isMobile) setSettingsOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!preferences.autoTrace) {
      autoStateRef.current = { key: '', status: 'done' };
    }
  }, [preferences.autoTrace]);

  const startTrace = useCallback(() => {
    if (!source || vectorizer.busy) return;
    manualTraceRef.current = true;
    autoSuppressedRef.current = null;
    autoStateRef.current = { key: '', status: 'done' };
    void vectorizer.trace();
  }, [source, vectorizer]);

  const cancelTrace = useCallback(() => {
    autoSuppressedRef.current = currentSignature;
    autoStateRef.current = { key: '', status: 'done' };
    vectorizer.cancel();
    toasts.show(m.toasts.cancelled, 'info');
  }, [currentSignature, m, toasts, vectorizer]);

  useEffect(() => {
    if (!source || !preferences.autoTrace || !currentSignature) return;
    if (currentResult?.paramsSignature === currentSignature) return;
    if (vectorizer.busy) return;
    if (autoSuppressedRef.current === currentSignature) return;

    const autoState = autoStateRef.current;
    if (
      autoState.key === currentSignature &&
      (autoState.status === 'scheduled' ||
        autoState.status === 'running' ||
        autoState.status === 'failed')
    ) {
      return;
    }

    autoStateRef.current = { key: currentSignature, status: 'scheduled' };
    const timer = window.setTimeout(() => {
      autoStateRef.current = { key: currentSignature, status: 'running' };
      manualTraceRef.current = false;
      void vectorizer.trace().then((result) => {
        autoStateRef.current = {
          key: currentSignature,
          status: result ? 'done' : 'failed',
        };
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    currentResult?.paramsSignature,
    currentSignature,
    preferences.autoTrace,
    source,
    vectorizer.busy,
    vectorizer.trace,
  ]);

  useEffect(() => {
    if (!isMobile || !settingsOpen) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>('#settings-panel .sidebar__header .icon-button')
        ?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobile, settingsOpen]);

  useEffect(() => {
    if (exportOpen && !currentResult) setExportOpen(false);
  }, [currentResult, exportOpen]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const loadFile = useCallback(
    async (file: File, successMessage?: string) => {
      try {
        const loaded = await loadSourceImage(file);
        setSource(loaded);
        setViewMode('original');
        setSettingsOpen(false);
        autoSuppressedRef.current = null;
        autoStateRef.current = { key: '', status: 'done' };
        toasts.show(successMessage ?? m.toasts.opened(loaded.name), 'info');
      } catch (error) {
        toasts.show(importErrorMessage(error, m), 'error');
      }
    },
    [m, toasts],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) {
        toasts.show(m.errors.noFile, 'error');
        return;
      }
      if (list.length > 1) {
        toasts.show(m.toasts.singleFile, 'info');
      }
      void loadFile(list[0]!);
    },
    [loadFile, m, toasts],
  );

  const loadSample = useCallback(async () => {
    setSampleLoading(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}examples/beispiel-logo.png`);
      if (!response.ok) throw new Error('sample');
      const blob = await response.blob();
      const file = new File([blob], 'beispiel-logo.png', { type: 'image/png' });
      await loadFile(file, m.toasts.sampleLoaded);
    } catch {
      toasts.show(m.errors.sampleFailed, 'error');
    } finally {
      setSampleLoading(false);
    }
  }, [loadFile, m, toasts]);

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFilePayload(event)) return;
      if (event.relatedTarget === null) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer?.files.length) handleFiles(event.dataTransfer.files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFiles]);

  useEffect(() => {
    if (exportOpen || infoOpen) return;
    const onPaste = (event: ClipboardEvent) => {
      // The explicit Ctrl/Cmd+V path below reads the clipboard itself; skip the
      // duplicate event once that path has already imported the image.
      if (clipboardReadRef.current === 'done') {
        event.preventDefault();
        clipboardReadRef.current = 'idle';
        return;
      }
      const items = Array.from(event.clipboardData?.items ?? []);
      const fileItems = items.filter((item) => item.kind === 'file');
      if (fileItems.length === 0) return;
      const imageItem = fileItems.find((item) => item.type.startsWith('image/'));
      if (!imageItem) {
        toasts.show(m.errors.invalidType, 'error');
        return;
      }
      const file = imageItem.getAsFile();
      if (!file) {
        toasts.show(m.errors.clipboardEmpty, 'error');
        return;
      }
      event.preventDefault();
      pasteDeliveredRef.current = Date.now();
      void loadFile(file, m.toasts.opened(file.name || 'zwischenablage.png'));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [exportOpen, infoOpen, loadFile, m, toasts]);

  /*
   * Ctrl/Cmd+V reads the clipboard directly through the async Clipboard API.
   * Some browsers only expose images as clipboard files inside the paste event
   * (or not at all), so this path runs first and the paste listener above stays
   * as the fallback.
   */
  useEffect(() => {
    if (exportOpen || infoOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() !== 'v') return;
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.read !== 'function') return;

      clipboardReadRef.current = 'pending';
      void (async () => {
        try {
          const entries = await clipboard.read();
          const entry = entries.find((item) =>
            item.types.some((type) => type.startsWith('image/')),
          );
          const type = entry?.types.find((candidate) => candidate.startsWith('image/'));
          if (!entry || !type) {
            clipboardReadRef.current = 'idle';
            return;
          }
          const blob = await entry.getType(type);
          // A paste event may already have delivered the same image.
          if (Date.now() - pasteDeliveredRef.current < 1_500) {
            clipboardReadRef.current = 'idle';
            return;
          }
          clipboardReadRef.current = 'done';
          window.setTimeout(() => {
            if (clipboardReadRef.current === 'done') clipboardReadRef.current = 'idle';
          }, 1_000);
          const extension = type === 'image/jpeg' ? 'jpg' : (type.split('/')[1] ?? 'png');
          const file = new File([blob], `zwischenablage.${extension}`, { type });
          await loadFile(file, m.toasts.opened(file.name));
        } catch {
          // Permission denied or unsupported: leave it to the paste listener.
          clipboardReadRef.current = 'failed';
          window.setTimeout(() => {
            if (clipboardReadRef.current === 'failed') clipboardReadRef.current = 'idle';
          }, 500);
        }
      })();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exportOpen, infoOpen, loadFile, m]);

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  }, []);

  const applyPreset = useCallback(
    (preset: Preset) => {
      history.update(() => ({ ...preset.params }), 'preset', true);
    },
    [history],
  );

  const resetGroup = useCallback(
    (group: 'form' | 'advanced' | 'preprocess' | 'mode') => {
      const next = resetParamsGroup(history.params, group);
      if (traceParamsEqual(next, history.params)) return;
      history.update(() => next, `reset-${group}`, true);
      const message =
        group === 'form'
          ? m.toasts.formReset
          : group === 'advanced'
            ? m.toasts.advancedReset
            : group === 'preprocess'
              ? m.toasts.preprocessReset
              : m.toasts.settingsReset;
      toasts.show(message, 'info');
    },
    [history, m, toasts],
  );

  const resetAll = useCallback(() => {
    history.update(() => ({ ...DEFAULT_TRACE_PARAMS }), 'reset-all', true);
    setPreferences((current) => ({
      ...current,
      background: DEFAULT_PREFERENCES.background,
      backgroundColor: DEFAULT_PREFERENCES.backgroundColor,
      workingResolution: DEFAULT_PREFERENCES.workingResolution,
    }));
    toasts.show(m.toasts.settingsReset, 'info');
  }, [history, m, toasts]);

  const resetBackground = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      background: DEFAULT_PREFERENCES.background,
      backgroundColor: DEFAULT_PREFERENCES.backgroundColor,
    }));
  }, []);

  const openExport = useCallback(() => {
    if (!currentResult) {
      toasts.show(m.header.exportDisabled, 'info');
      setViewMode('original');
      return;
    }
    setExportOpen(true);
  }, [currentResult, m, toasts]);

  useShortcuts(
    {
      onOpen: openFilePicker,
      onExport: openExport,
      onTrace: startTrace,
      onUndo: history.undo,
      onRedo: history.redo,
      onFit: () => viewerRef.current?.fit(),
      onActualSize: () => viewerRef.current?.actualSize(),
      onZoomIn: () => viewerRef.current?.zoomIn(),
      onZoomOut: () => viewerRef.current?.zoomOut(),
    },
    !exportOpen && !infoOpen,
  );

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        {m.common.skipToContent}
      </a>

      <Header
        hasImage={Boolean(source)}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        canExport={Boolean(currentResult)}
        onOpen={openFilePicker}
        onUndo={history.undo}
        onRedo={history.redo}
        onExport={openExport}
        onInfo={() => setInfoOpen(true)}
      />

      <div className="app-body">
        {source ? (
          <div className="workspace" id="main-content">
            <Viewer
              ref={viewerRef}
              source={source}
              result={currentResult}
              stale={stale}
              job={vectorizer.job}
              preferences={preferences}
              viewMode={currentResult ? viewMode : 'original'}
              onPreferences={updatePreferences}
              onViewMode={setViewMode}
              onTrace={startTrace}
              onOpenSettings={() => setSettingsOpen(true)}
              isMobile={isMobile}
            />

            {isMobile && settingsOpen ? (
              <button
                type="button"
                className="sheet-backdrop"
                aria-label={m.sidebar.closeSettings}
                onClick={() => setSettingsOpen(false)}
              />
            ) : null}

            <Sidebar
              open={isMobile ? settingsOpen : true}
              isMobile={isMobile}
              onClose={() => setSettingsOpen(false)}
              source={source}
              params={history.params}
              preferences={preferences}
              result={currentResult}
              stale={stale}
              job={vectorizer.job}
              error={vectorizer.error}
              busy={busy}
              onPatch={history.patch}
              onPreset={applyPreset}
              onResetGroup={resetGroup}
              onResetAll={resetAll}
              onResetBackground={resetBackground}
              onPreferences={updatePreferences}
              onTrace={startTrace}
              onCancel={cancelTrace}
            />
          </div>
        ) : (
          <EmptyState onOpen={openFilePicker} onSample={() => void loadSample()} sampleLoading={sampleLoading} />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="file-input"
        tabIndex={-1}
        data-testid="file-input"
        onChange={(event) => {
          if (event.target.files?.length) handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {dragging ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay__card">
            <IconUpload size={26} stroke={1.6} />
            <strong>{m.viewer.dropTitle}</strong>
            <span>{m.viewer.dropBody}</span>
          </div>
        </div>
      ) : null}

      {exportOpen && currentResult && source ? (
        <ExportDialog
          source={source}
          result={currentResult}
          preferences={preferences}
          stale={stale}
          onClose={() => setExportOpen(false)}
          toasts={toasts}
        />
      ) : null}

      {infoOpen ? <AboutDialog onClose={() => setInfoOpen(false)} /> : null}

      <PrivacyNotice onShowDetails={() => setInfoOpen(true)} />

      <ToastViewport {...toasts} />
    </div>
  );
}
