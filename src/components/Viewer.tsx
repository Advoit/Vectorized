import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconArrowsHorizontal,
  IconFile,
  IconFocusCentered,
  IconGridDots,
  IconMoon,
  IconPhoto,
  IconSun,
  IconVector,
  IconVectorBezier2,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react';
import { de } from '../i18n/de';
import type { SourceImage } from '../image/load';
import { formatBytes, formatCount } from '../trace/postprocess';
import type { JobState, Preferences, TraceResult, ViewMode } from '../trace/types';
import { IconButton } from './IconButton';
import { Segmented } from './Segmented';
import { Spinner } from './Spinner';

export interface ViewerHandle {
  fit: () => void;
  actualSize: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface ViewerProps {
  source: SourceImage;
  result: TraceResult | null;
  stale: boolean;
  job: JobState;
  preferences: Preferences;
  viewMode: ViewMode;
  onPreferences: (patch: Partial<Preferences>) => void;
  onViewMode: (mode: ViewMode) => void;
  onTrace: () => void;
  onOpenSettings: () => void;
  isMobile: boolean;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.01;
const MAX_SCALE = 16;
const FIT_PADDING = 64;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function backgroundLuminance(preferences: Preferences): number {
  if (preferences.background === 'white') return 255;
  if (preferences.background === 'custom') {
    const hex = preferences.backgroundColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return preferences.previewBackground === 'dark' ? 32 : 247;
}

function jobLabel(job: JobState): string {
  switch (job.phase) {
    case 'preparing':
      return de.status.preparing;
    case 'tracing':
      return de.status.tracing;
    case 'finalizing':
      return de.status.finalizing;
    default:
      return de.status.ready;
  }
}

export const Viewer = forwardRef<ViewerHandle, ViewerProps>(function Viewer(
  {
    source,
    result,
    stale,
    job,
    preferences,
    viewMode,
    onPreferences,
    onViewMode,
    onTrace,
    onOpenSettings,
    isMobile,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleDragRef = useRef(false);
  const pointerMap = useRef(new Map<number, { x: number; y: number }>());
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{
    distance: number;
    midX: number;
    midY: number;
    scale: number;
    panX: number;
    panY: number;
  } | null>(null);
  const initializedRef = useRef(false);
  const transformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const [split, setSplit] = useState(50);
  const [panning, setPanning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  transformRef.current = transform;

  const updateTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

  const zoomAt = useCallback(
    (pointX: number, pointY: number, factor: number) => {
      const current = transformRef.current;
      const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      if (nextScale === current.scale) return;
      const ratio = nextScale / current.scale;
      updateTransform({
        scale: nextScale,
        x: pointX - (pointX - current.x) * ratio,
        y: pointY - (pointY - current.y) * ratio,
      });
    },
    [updateTransform],
  );

  const fit = useCallback(() => {
    if (!containerSize.width || !containerSize.height) return;
    const availableWidth = Math.max(40, containerSize.width - FIT_PADDING);
    const availableHeight = Math.max(40, containerSize.height - FIT_PADDING);
    const scale = clamp(
      Math.min(availableWidth / source.width, availableHeight / source.height),
      MIN_SCALE,
      8,
    );
    updateTransform({ scale, x: 0, y: 0 });
    initializedRef.current = true;
  }, [containerSize.height, containerSize.width, source.height, source.width, updateTransform]);

  const actualSize = useCallback(() => {
    updateTransform({ scale: 1, x: 0, y: 0 });
    initializedRef.current = true;
  }, [updateTransform]);

  useImperativeHandle(
    ref,
    () => ({
      fit,
      actualSize,
      zoomIn: () => zoomAt(0, 0, 1.25),
      zoomOut: () => zoomAt(0, 0, 0.8),
    }),
    [actualSize, fit, zoomAt],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    setContainerSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    initializedRef.current = false;
    setSplit(50);
    setTransform({ scale: 1, x: 0, y: 0 });
    transformRef.current = { scale: 1, x: 0, y: 0 };
  }, [source.id]);

  useEffect(() => {
    if (!initializedRef.current && containerSize.width > 0) {
      fit();
    }
  }, [containerSize.height, containerSize.width, fit, source.id]);

  useEffect(() => {
    if (job.phase === 'idle' || job.startedAt === null) {
      setElapsed(0);
      return;
    }
    const update = () => setElapsed((Date.now() - (job.startedAt ?? Date.now())) / 1000);
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [job.phase, job.startedAt]);

  const vectorBackground =
    preferences.background === 'white'
      ? '#ffffff'
      : preferences.background === 'custom'
        ? preferences.backgroundColor
        : null;

  const vectorPreview = useMemo(() => {
    if (!result) return null;
    const contourColor = backgroundLuminance(preferences) < 128 ? '#8fd0b3' : '#1f4a3b';
    return (
      <svg
        className="stage__svg"
        viewBox={`0 0 ${result.width} ${result.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={de.viewer.vectorAlt}
        data-testid="vector-preview"
      >
        {vectorBackground ? (
          <rect
            x={0}
            y={0}
            width={result.width}
            height={result.height}
            fill={vectorBackground}
          />
        ) : null}
        {result.paths.map((path, index) => (
          <path
            key={index}
            d={path.d}
            fill={preferences.showContours ? 'none' : path.fill}
            {...(preferences.showContours
              ? {
                  stroke: contourColor,
                  strokeWidth: 1,
                  strokeLinejoin: 'round',
                  vectorEffect: 'non-scaling-stroke',
                }
              : null)}
            {...(path.transform ? { transform: path.transform } : null)}
          />
        ))}
      </svg>
    );
  }, [
    preferences,
    result,
    vectorBackground,
  ]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const wheelHandler = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const pointX = event.clientX - rect.left - rect.width / 2;
      const pointY = event.clientY - rect.top - rect.height / 2;
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomAt(pointX, pointY, factor);
    };
    element.addEventListener('wheel', wheelHandler, { passive: false });
    return () => element.removeEventListener('wheel', wheelHandler);
  }, [zoomAt]);

  const splitFromClientX = useCallback((clientX: number) => {
    const element = containerRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setSplit(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
  }, []);

  const beginHandleDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    handleDragRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    splitFromClientX(event.clientX);
  };

  const moveHandle = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!handleDragRef.current) return;
    event.stopPropagation();
    splitFromClientX(event.clientX);
  };

  const endHandleDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!handleDragRef.current) return;
    event.stopPropagation();
    handleDragRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSplitKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let next = split;
    if (event.key === 'ArrowLeft') next = split - 2;
    else if (event.key === 'ArrowRight') next = split + 2;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 100;
    else return;
    event.preventDefault();
    setSplit(clamp(next, 0, 100));
  };

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-no-pan]')) return;
    const element = containerRef.current;
    if (!element) return;
    element.focus({ preventScroll: true });
    element.setPointerCapture(event.pointerId);
    pointerMap.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointerMap.current.size === 1) {
      panStart.current = {
        x: event.clientX,
        y: event.clientY,
        panX: transformRef.current.x,
        panY: transformRef.current.y,
      };
      pinchStart.current = null;
      setPanning(true);
    } else if (pointerMap.current.size === 2) {
      panStart.current = null;
      const points = [...pointerMap.current.values()];
      const first = points[0]!;
      const second = points[1]!;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const midX = (first.x + second.x) / 2;
      const midY = (first.y + second.y) / 2;
      pinchStart.current = {
        distance: Math.max(1, distance),
        midX,
        midY,
        scale: transformRef.current.scale,
        panX: transformRef.current.x,
        panY: transformRef.current.y,
      };
    }
  };

  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerMap.current.has(event.pointerId)) return;
    pointerMap.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointerMap.current.size >= 2 && pinchStart.current) {
      const element = containerRef.current;
      if (!element) return;
      const points = [...pointerMap.current.values()];
      const first = points[0]!;
      const second = points[1]!;
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const rect = element.getBoundingClientRect();
      const midX = (first.x + second.x) / 2 - rect.left - rect.width / 2;
      const midY = (first.y + second.y) / 2 - rect.top - rect.height / 2;
      const start = pinchStart.current;
      const nextScale = clamp(
        start.scale * (distance / start.distance),
        MIN_SCALE,
        MAX_SCALE,
      );
      const ratio = nextScale / start.scale;
      updateTransform({
        scale: nextScale,
        x: midX - (start.midX - rect.left - rect.width / 2 - start.panX) * ratio,
        y: midY - (start.midY - rect.top - rect.height / 2 - start.panY) * ratio,
      });
      return;
    }

    if (pointerMap.current.size === 1 && panStart.current) {
      const start = panStart.current;
      updateTransform({
        scale: transformRef.current.scale,
        x: start.panX + (event.clientX - start.x),
        y: start.panY + (event.clientY - start.y),
      });
    }
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerMap.current.delete(event.pointerId);
    const element = containerRef.current;
    if (element?.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    if (pointerMap.current.size === 0) {
      panStart.current = null;
      pinchStart.current = null;
      setPanning(false);
    } else if (pointerMap.current.size === 1) {
      const remaining = [...pointerMap.current.values()][0]!;
      panStart.current = {
        x: remaining.x,
        y: remaining.y,
        panX: transformRef.current.x,
        panY: transformRef.current.y,
      };
      pinchStart.current = null;
    }
  };

  const handleCanvasKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = 32;
    let x = transformRef.current.x;
    let y = transformRef.current.y;
    if (event.key === 'ArrowLeft') x -= step;
    else if (event.key === 'ArrowRight') x += step;
    else if (event.key === 'ArrowUp') y -= step;
    else if (event.key === 'ArrowDown') y += step;
    else return;
    event.preventDefault();
    updateTransform({ ...transformRef.current, x, y });
  };

  const vectorVisible = Boolean(result) && viewMode !== 'original';
  const compareVisible = Boolean(result) && viewMode === 'compare';
  const showNoResult = !result && viewMode !== 'original';
  const zoomPercent = Math.round(transform.scale * 100);

  return (
    <section className="viewer-column" aria-label={de.viewer.stageLabel}>
      <div className="viewer-toolbar">
        <Segmented
          label={de.viewer.modesLabel}
          value={viewMode}
          onChange={onViewMode}
          iconOnlyMobile
          options={[
            {
              value: 'original',
              label: de.viewer.original,
              icon: <IconPhoto size={15} stroke={1.7} />,
              ariaLabel: de.viewer.original,
            },
            {
              value: 'compare',
              label: de.viewer.compare,
              icon: <IconArrowsHorizontal size={15} stroke={1.7} />,
              disabled: !result,
              disabledReason: de.viewer.noResultTitle,
              ariaLabel: de.viewer.compare,
            },
            {
              value: 'vector',
              label: de.viewer.vector,
              icon: <IconVectorBezier2 size={15} stroke={1.7} />,
              disabled: !result,
              disabledReason: de.viewer.noResultTitle,
              ariaLabel: de.viewer.vector,
            },
          ]}
        />

        <div className="viewer-toolbar__spacer" />

        <div className="preview-backgrounds" role="group" aria-label={de.viewer.backgroundLabel}>
          <IconButton
            label={de.viewer.backgroundLight}
            icon={<IconSun size={16} stroke={1.7} />}
            active={preferences.previewBackground === 'light'}
            onClick={() => onPreferences({ previewBackground: 'light' })}
          />
          <IconButton
            label={de.viewer.backgroundDark}
            icon={<IconMoon size={16} stroke={1.7} />}
            active={preferences.previewBackground === 'dark'}
            onClick={() => onPreferences({ previewBackground: 'dark' })}
          />
          <IconButton
            label={de.viewer.backgroundChecker}
            icon={<IconGridDots size={16} stroke={1.7} />}
            active={preferences.previewBackground === 'checker'}
            onClick={() => onPreferences({ previewBackground: 'checker' })}
          />
        </div>

        <span className="toolbar-divider" aria-hidden="true" />

        <IconButton
          label={de.viewer.contours}
          icon={<IconVector size={16} stroke={1.7} />}
          active={preferences.showContours}
          disabled={!result}
          onClick={() => onPreferences({ showContours: !preferences.showContours })}
        />

        {isMobile ? (
          <IconButton
            label={de.sidebar.openSettings}
            icon={<IconAdjustmentsHorizontal size={17} stroke={1.7} />}
            onClick={onOpenSettings}
          />
        ) : null}
      </div>

      <div
        ref={containerRef}
        className={`canvas-wrap preview-${preferences.previewBackground}${panning ? ' is-panning' : ''}`}
        tabIndex={0}
        role="group"
        aria-label={de.viewer.stageLabel}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={fit}
        onKeyDown={handleCanvasKey}
      >
        <div
          className="stage"
          style={{
            width: source.width,
            height: source.height,
            transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          {viewMode !== 'vector' || !result ? (
            <img
              className="stage__image"
              src={source.url}
              alt={de.viewer.originalAlt}
              draggable={false}
              data-testid="original-preview"
            />
          ) : null}

          {vectorVisible && vectorPreview ? (
            <div
              className="stage__vector-layer"
              style={compareVisible ? { clipPath: `inset(0 0 0 ${split}%)` } : undefined}
            >
              {vectorPreview}
            </div>
          ) : null}
        </div>

        {compareVisible && result ? (
          <>
            <div className="compare-legend" aria-hidden="true">
              <span className="compare-legend__chip">{de.viewer.originalLabel}</span>
              <span className="compare-legend__chip">{de.viewer.vectorLabel}</span>
            </div>
            <div
              className="compare-control"
              style={{ left: `${split}%` }}
              data-no-pan
              data-testid="compare-handle"
              role="slider"
              tabIndex={0}
              aria-label={de.viewer.splitLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(split)}
              aria-valuetext={`${Math.round(split)} %`}
              onPointerDown={beginHandleDrag}
              onPointerMove={moveHandle}
              onPointerUp={endHandleDrag}
              onPointerCancel={endHandleDrag}
              onKeyDown={handleSplitKey}
            >
              <span className="compare-control__line" aria-hidden="true" />
              <span className="compare-control__knob" aria-hidden="true">
                <IconArrowsHorizontal size={15} stroke={1.8} />
              </span>
            </div>
          </>
        ) : null}

        {showNoResult ? (
          <div className="canvas-message" role="status">
            <h2>{de.viewer.noResultTitle}</h2>
            <p>{de.viewer.noResultBody}</p>
            <button type="button" className="btn btn--primary" onClick={onTrace}>
              {de.viewer.noResultAction}
            </button>
          </div>
        ) : null}

        {!result && !showNoResult && job.phase === 'idle' ? (
          <div className="canvas-cta" data-no-pan>
            <div>
              <strong>{de.viewer.noResultTitle}</strong>
              <span>{de.viewer.noResultBody}</span>
            </div>
            <button type="button" className="btn btn--primary" onClick={onTrace}>
              {de.viewer.noResultAction}
            </button>
          </div>
        ) : null}

        {stale && result && job.phase === 'idle' ? (
          <div className="stale-badge" data-no-pan role="status" data-testid="stale-badge">
            <IconAlertTriangle size={15} stroke={1.9} aria-hidden="true" />
            <span>
              <strong>{de.viewer.stale}</strong> {de.viewer.staleHint}
            </span>
            <button type="button" className="link-button" onClick={onTrace}>
              {de.viewer.staleAction}
            </button>
          </div>
        ) : null}

        {job.phase !== 'idle' ? (
          <div className="canvas-progress" role="status">
            <Spinner />
            <span>{jobLabel(job)}</span>
            <span className="numeric">
              {de.status.elapsed((elapsed < 10 ? elapsed.toFixed(1) : Math.round(elapsed).toString()).replace('.', ','))}
            </span>
          </div>
        ) : null}
      </div>

      <div className="viewer-status">
        <div className="viewer-status__left">
          <span className="status-file" title={source.name}>
            <IconFile size={13} stroke={1.7} aria-hidden="true" />
            <span className="status-file__name">{source.name}</span>
          </span>
          <span className="status-sep" aria-hidden="true">
            ·
          </span>
          <span className="numeric">{de.status.imageInfo(source.width, source.height)}</span>
          <span className="status-optional status-sep" aria-hidden="true">
            ·
          </span>
          <span className="status-optional numeric">{formatBytes(source.size)}</span>
        </div>

        <div className="viewer-status__center" aria-live="polite">
          <span className={`status-indicator${stale ? ' is-stale' : ''}`} data-testid="job-status">
            {job.phase !== 'idle' ? <Spinner size={12} /> : null}
            {stale && job.phase === 'idle' ? (
              <IconAlertTriangle size={12} stroke={1.9} aria-hidden="true" />
            ) : null}
            {job.phase === 'idle' && !stale ? (
              <span className="status-dot" aria-hidden="true" />
            ) : null}
            {stale && job.phase === 'idle' ? de.status.stale : jobLabel(job)}
          </span>
          {result && !stale ? (
            <span className="status-working numeric" title={de.status.workingInfo(result.width, result.height)}>
              {de.status.workingInfo(result.width, result.height)}
            </span>
          ) : null}
        </div>

        <div className="viewer-status__right">
          {result ? (
            <span className="status-result numeric" data-testid="result-info">
              {de.status.resultInfo(formatCount(result.stats.pathCount), formatBytes(result.stats.bytes))}
            </span>
          ) : null}
          <span className="status-sep status-result" aria-hidden="true">
            ·
          </span>
          <div className="zoom-controls">
            <IconButton
              label={de.viewer.zoomOut}
              icon={<IconZoomOut size={14} stroke={1.8} />}
              onClick={() => zoomAt(0, 0, 0.8)}
              tooltipSide="top"
            />
            <span className="zoom-value numeric" aria-label={`${de.viewer.zoomValue} ${zoomPercent} %`}>
              {de.status.zoom(formatCount(zoomPercent))}
            </span>
            <IconButton
              label={de.viewer.zoomIn}
              icon={<IconZoomIn size={14} stroke={1.8} />}
              onClick={() => zoomAt(0, 0, 1.25)}
              tooltipSide="top"
            />
            <IconButton
              label={`${de.viewer.fit} (${de.shortcuts.fit})`}
              icon={<IconFocusCentered size={14} stroke={1.8} />}
              onClick={fit}
              tooltipSide="top"
            />
            <button type="button" className="status-text-button" onClick={actualSize} title={de.viewer.actualSizeTooltip}>
              {de.viewer.actualSize}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
});
