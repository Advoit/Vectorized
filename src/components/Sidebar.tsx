import { useEffect, useState } from 'react';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCircleHalf2,
  IconInfoCircle,
  IconPalette,
  IconRefresh,
  IconVectorBezier2,
  IconX,
} from '@tabler/icons-react';
import { useMessages, useNumberFormat } from '../i18n';
import type { SourceImage } from '../image/load';
import {
  isGroupDefault,
  matchingPreset,
  PARAM_RANGES,
  PRESETS,
  resolutionLabel,
  workingDimensions,
  WORKING_RESOLUTIONS,
  type Preset,
} from '../trace/settings';
import type { JobState, Preferences, TraceParams, TraceResult } from '../trace/types';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Segmented } from './Segmented';
import { SliderField } from './SliderField';
import { Spinner } from './Spinner';
import { Switch } from './Switch';

interface SidebarProps {
  open: boolean;
  isMobile: boolean;
  onClose: () => void;
  source: SourceImage;
  params: TraceParams;
  preferences: Preferences;
  result: TraceResult | null;
  stale: boolean;
  job: JobState;
  error: string | null;
  busy: boolean;
  onPatch: (patch: Partial<TraceParams>, group: string, forceNew?: boolean) => void;
  onPreset: (preset: Preset) => void;
  onResetGroup: (group: 'form' | 'advanced' | 'preprocess' | 'mode') => void;
  onResetAll: () => void;
  onResetBackground: () => void;
  onPreferences: (patch: Partial<Preferences>) => void;
  onTrace: () => void;
  onCancel: () => void;
}

export function Sidebar({
  open,
  isMobile,
  onClose,
  source,
  params,
  preferences,
  result,
  stale,
  job,
  error,
  busy,
  onPatch,
  onPreset,
  onResetGroup,
  onResetAll,
  onResetBackground,
  onPreferences,
  onTrace,
  onCancel,
}: SidebarProps) {
  const m = useMessages();
  const { decimal } = useNumberFormat();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const activePreset = matchingPreset(params);

  const working = workingDimensions(source.width, source.height, preferences.workingResolution);
  const isLarge =
    preferences.workingResolution > 0 &&
    Math.max(source.width, source.height) > preferences.workingResolution;
  const originalSelected = preferences.workingResolution === 0;
  const formChanged = !isGroupDefault(params, 'form');
  const advancedChanged = !isGroupDefault(params, 'advanced');
  const preprocessChanged = !isGroupDefault(params, 'preprocess');
  const modeChanged = !isGroupDefault(params, 'mode');
  const backgroundChanged =
    preferences.background !== 'transparent' || preferences.backgroundColor !== '#ffffff';

  useEffect(() => {
    if (job.phase === 'idle' || job.startedAt === null) {
      setElapsed(0);
      return;
    }
    const update = () => setElapsed((Date.now() - (job.startedAt ?? Date.now())) / 1000);
    update();
    const timer = window.setInterval(update, 300);
    return () => window.clearInterval(timer);
  }, [job.phase, job.startedAt]);

  const phaseText =
    job.phase === 'preparing'
      ? m.status.preparing
      : job.phase === 'tracing'
        ? m.status.tracing
        : m.status.finalizing;

  return (
    <aside
      className={`sidebar${open ? ' is-open' : ''}`}
      aria-label={m.sidebar.title}
      id="settings-panel"
    >
      <header className="sidebar__header">
        <h2>{m.sidebar.title}</h2>
        {isMobile ? (
          <IconButton
            label={m.sidebar.closeSettings}
            icon={<IconX size={17} stroke={1.7} />}
            onClick={onClose}
          />
        ) : null}
      </header>

      <div className="sidebar__scroll">
        <section className="sidebar-section">
          <div className="section-head">
            <h3>{m.sidebar.presets}</h3>
          </div>
          <div className="preset-row" role="group" aria-label={m.sidebar.presets}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-button${activePreset === preset.id ? ' is-active' : ''}`}
                onClick={() => onPreset(preset)}
                aria-pressed={activePreset === preset.id}
              >
                {preset.id === 'logo'
                  ? m.presets.logo.name
                  : preset.id === 'illustration'
                    ? m.presets.illustration.name
                    : m.presets.bw.name}
              </button>
            ))}
          </div>
          <p className="preset-description">
            {activePreset === 'logo'
              ? m.presets.logo.description
              : activePreset === 'illustration'
                ? m.presets.illustration.description
                : activePreset === 'bw'
                  ? m.presets.bw.description
                  : m.sidebar.customPreset}
          </p>
        </section>

        <section className="sidebar-section">
          <div className="section-head">
            <h3>{m.sidebar.mode}</h3>
            {modeChanged ? (
              <IconButton
                label={m.sidebar.resetMode}
                icon={<IconRefresh size={13} stroke={1.8} />}
                onClick={() => onResetGroup('mode')}
              />
            ) : null}
          </div>
          <Segmented
            fill
            label={m.sidebar.mode}
            value={params.colorMode}
            onChange={(value) => onPatch({ colorMode: value }, 'mode', true)}
            options={[
              {
                value: 'color',
                label: m.sidebar.colorMode,
                icon: <IconPalette size={15} stroke={1.7} />,
              },
              {
                value: 'bw',
                label: m.sidebar.bwMode,
                icon: <IconCircleHalf2 size={15} stroke={1.7} />,
              },
            ]}
          />
          {params.colorMode === 'bw' ? <p className="info-note">{m.sidebar.bwHint}</p> : null}
        </section>

        <section className="sidebar-section">
          <div className="section-head">
            <h3>{m.sidebar.form}</h3>
            {formChanged ? (
              <IconButton
                label={m.sidebar.resetForm}
                icon={<IconRefresh size={13} stroke={1.8} />}
                onClick={() => onResetGroup('form')}
              />
            ) : null}
          </div>

          <SliderField
            id="color-detail"
            label={m.sidebar.colorDetail}
            value={params.colorPrecision}
            min={PARAM_RANGES.colorPrecision.min}
            max={PARAM_RANGES.colorPrecision.max}
            step={PARAM_RANGES.colorPrecision.step}
            valueText={m.sidebar.colorDetailValue(params.colorPrecision)}
            hint={m.sidebar.colorDetailHint}
            disabled={params.colorMode === 'bw'}
            disabledHint={m.sidebar.bwHint}
            onChange={(value) => onPatch({ colorPrecision: value }, 'colorPrecision')}
          />

          <SliderField
            id="smoothing"
            label={m.sidebar.smoothing}
            value={params.lengthThreshold}
            min={PARAM_RANGES.lengthThreshold.min}
            max={PARAM_RANGES.lengthThreshold.max}
            step={PARAM_RANGES.lengthThreshold.step}
            valueText={decimal(params.lengthThreshold)}
            hint={m.sidebar.smoothingHint}
            onChange={(value) => onPatch({ lengthThreshold: value }, 'lengthThreshold')}
          />

          <SliderField
            id="speckle"
            label={m.sidebar.speckle}
            value={params.filterSpeckle}
            min={PARAM_RANGES.filterSpeckle.min}
            max={PARAM_RANGES.filterSpeckle.max}
            step={PARAM_RANGES.filterSpeckle.step}
            valueText={m.sidebar.speckleValue(params.filterSpeckle)}
            hint={m.sidebar.speckleHint}
            onChange={(value) => onPatch({ filterSpeckle: value }, 'filterSpeckle')}
          />

          <button
            type="button"
            className="disclosure"
            aria-expanded={advancedOpen}
            aria-controls="advanced-options"
            onClick={() => setAdvancedOpen((current) => !current)}
          >
            <span>{m.sidebar.advanced}</span>
            <span className={`disclosure__chevron${advancedOpen ? ' is-open' : ''}`} aria-hidden="true">
              <IconChevronDown size={15} stroke={1.8} />
            </span>
          </button>

          {advancedOpen ? (
            <div id="advanced-options" className="advanced-stack">
              <div className="advanced-head">
                {advancedChanged ? (
                  <IconButton
                    label={m.sidebar.resetAdvanced}
                    icon={<IconRefresh size={13} stroke={1.8} />}
                    onClick={() => onResetGroup('advanced')}
                  />
                ) : null}
              </div>
              <SliderField
                id="corners"
                label={m.sidebar.corners}
                value={params.cornerThreshold}
                min={PARAM_RANGES.cornerThreshold.min}
                max={PARAM_RANGES.cornerThreshold.max}
                step={PARAM_RANGES.cornerThreshold.step}
                valueText={`${params.cornerThreshold}°`}
                hint={m.sidebar.cornersHint}
                onChange={(value) => onPatch({ cornerThreshold: value }, 'cornerThreshold')}
              />
              <SliderField
                id="color-gap"
                label={m.sidebar.colorGap}
                value={params.layerDifference}
                min={PARAM_RANGES.layerDifference.min}
                max={PARAM_RANGES.layerDifference.max}
                step={PARAM_RANGES.layerDifference.step}
                valueText={String(params.layerDifference)}
                hint={m.sidebar.colorGapHint}
                disabled={params.colorMode === 'bw'}
                disabledHint={m.sidebar.bwHint}
                onChange={(value) => onPatch({ layerDifference: value }, 'layerDifference')}
              />
              <div className="field">
                <span className="field-label">{m.sidebar.curveMode}</span>
                <Segmented
                  fill
                  label={m.sidebar.curveMode}
                  value={params.curveMode}
                  onChange={(value) => onPatch({ curveMode: value }, 'curveMode', true)}
                  options={[
                    {
                      value: 'spline',
                      label: m.sidebar.spline,
                      disabled: true,
                      disabledReason: m.sidebar.splineUnavailable,
                    },
                    { value: 'polygon', label: m.sidebar.polygon },
                  ]}
                />
              </div>
              <SliderField
                id="splice"
                label={m.sidebar.splice}
                value={params.spliceThreshold}
                min={PARAM_RANGES.spliceThreshold.min}
                max={PARAM_RANGES.spliceThreshold.max}
                step={PARAM_RANGES.spliceThreshold.step}
                valueText={`${params.spliceThreshold}°`}
                hint={m.sidebar.spliceHint}
                onChange={(value) => onPatch({ spliceThreshold: value }, 'spliceThreshold')}
              />
              <p className="engine-note">{m.sidebar.engineNote}</p>
            </div>
          ) : null}
        </section>

        <section className="sidebar-section">
          <div className="section-head">
            <h3>{m.sidebar.preprocessing}</h3>
            {preprocessChanged ? (
              <IconButton
                label={m.sidebar.resetPreprocess}
                icon={<IconRefresh size={13} stroke={1.8} />}
                onClick={() => onResetGroup('preprocess')}
              />
            ) : null}
          </div>

          <Switch
            checked={params.removeBackground}
            onChange={(checked) => onPatch({ removeBackground: checked }, 'removeBackground', true)}
            label={m.sidebar.removeBackground}
            description={m.sidebar.removeBackgroundHint}
          />

          {params.removeBackground ? (
            <div className="switch-subfield">
              <SliderField
                id="background-tolerance"
                label={m.sidebar.tolerance}
                value={params.backgroundTolerance}
                min={PARAM_RANGES.backgroundTolerance.min}
                max={PARAM_RANGES.backgroundTolerance.max}
                step={PARAM_RANGES.backgroundTolerance.step}
                valueText={`${params.backgroundTolerance} %`}
                hint={m.sidebar.toleranceHint}
                onChange={(value) => onPatch({ backgroundTolerance: value }, 'backgroundTolerance')}
              />
            </div>
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor="working-resolution">
              {m.sidebar.resolution}
            </label>
            <select
              id="working-resolution"
              className="select"
              value={preferences.workingResolution}
              onChange={(event) => onPreferences({ workingResolution: Number(event.target.value) })}
            >
              {WORKING_RESOLUTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? m.sidebar.resolutionOriginal : resolutionLabel(value)}
                </option>
              ))}
            </select>
            <p className="field-hint">{m.sidebar.resolutionHint}</p>
            <p className="field-hint numeric">
              {m.status.imageInfo(working.width, working.height)}
              {isLarge
                ? ` · ${m.sidebar.largeImageBody(source.width, source.height, preferences.workingResolution)}`
                : ''}
            </p>
            {originalSelected && source.width * source.height > 12_000_000 ? (
              <p className="warning-note">{m.sidebar.originalWarning}</p>
            ) : null}
          </div>
        </section>

        <section className="sidebar-section">
          <div className="section-head">
            <h3>{m.sidebar.output}</h3>
            {backgroundChanged ? (
              <IconButton
                label={m.sidebar.resetBackground}
                icon={<IconRefresh size={13} stroke={1.8} />}
                onClick={onResetBackground}
              />
            ) : null}
          </div>
          <Segmented
            fill
            label={m.sidebar.background}
            value={preferences.background}
            onChange={(value) => onPreferences({ background: value })}
            options={[
              { value: 'transparent', label: m.sidebar.bgTransparent },
              { value: 'white', label: m.sidebar.bgWhite },
              { value: 'custom', label: m.sidebar.bgCustom },
            ]}
          />
          {preferences.background === 'custom' ? (
            <div className="color-field">
              <label htmlFor="background-color">{m.sidebar.bgColorLabel}</label>
              <div className="color-field__control">
                <input
                  id="background-color"
                  type="color"
                  value={preferences.backgroundColor}
                  onChange={(event) => onPreferences({ backgroundColor: event.target.value })}
                />
                <span className="numeric">{preferences.backgroundColor.toUpperCase()}</span>
              </div>
            </div>
          ) : null}
          <p className="field-hint">{m.sidebar.backgroundHint}</p>
        </section>

        {result ? (
          <section className="sidebar-section result-notes">
            {result.hadTransparency ? (
              <p>
                <IconInfoCircle size={14} stroke={1.7} aria-hidden="true" />
                <span>{m.sidebar.transparencyHint}</span>
              </p>
            ) : null}
            {result.sourceColorEstimate > 4096 ? (
              <p>
                <IconAlertTriangle size={14} stroke={1.7} aria-hidden="true" />
                <span>{m.sidebar.photoHint}</span>
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="sidebar-section">
          <Switch
            checked={preferences.autoTrace}
            onChange={(checked) => onPreferences({ autoTrace: checked })}
            label={m.sidebar.autoTrace}
            description={m.sidebar.autoTraceHint}
          />
          <button type="button" className="text-button sidebar-reset-all" onClick={onResetAll}>
            <IconRefresh size={13} stroke={1.8} aria-hidden="true" />
            {m.sidebar.resetAll}
          </button>
        </section>
      </div>

      <footer className="sidebar__footer">
        {error ? (
          <div className="inline-error" role="alert">
            <IconAlertTriangle size={15} stroke={1.9} aria-hidden="true" />
            <p>{error}</p>
            <div className="inline-error__actions">
              <Button variant="secondary" onClick={onTrace} icon={<IconRefresh size={14} />}>
                {m.actions.retry}
              </Button>
            </div>
          </div>
        ) : null}

        {busy ? (
          <div className="job-progress">
            <div className="job-progress__head">
              <span className="job-progress__label">
                <Spinner size={14} />
                {phaseText}
              </span>
              <span className="numeric">{m.status.elapsed(decimal(elapsed))}</span>
            </div>
            <div className="progress-bar" role="presentation">
              <span />
            </div>
            <Button
              variant="secondary"
              block
              onClick={onCancel}
              icon={<IconX size={15} />}
              data-testid="cancel-button"
            >
              {m.actions.cancel}
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="primary"
              block
              onClick={onTrace}
              icon={<IconVectorBezier2 size={17} stroke={1.8} />}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              data-testid="trace-button"
            >
              {result ? m.actions.update : m.actions.vectorize}
            </Button>
            <p className="primary-hint">
              {m.shortcuts.vectorize} ·{' '}
              <span>{stale ? m.viewer.staleHint : m.sidebar.primaryHint}</span>
            </p>
          </>
        )}
      </footer>
    </aside>
  );
}
