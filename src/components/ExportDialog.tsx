import { useMemo, useState } from 'react';
import {
  IconAlertTriangle,
  IconCopy,
  IconDownload,
  IconPhoto,
  IconVector,
} from '@tabler/icons-react';
import { de } from '../i18n/de';
import {
  copyText,
  downloadPngFile,
  downloadSvgFile,
  exportBaseName,
  fileNameWithExtension,
  validatePngDimensions,
} from '../export/download';
import type { SourceImage } from '../image/load';
import { buildSvgDocument, formatBytes, formatCount, utf8ByteLength } from '../trace/postprocess';
import type { BackgroundMode, Preferences, TraceResult } from '../trace/types';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Segmented } from './Segmented';
import { Switch } from './Switch';
import type { ToastApi } from '../state/useToasts';

interface ExportDialogProps {
  source: SourceImage;
  result: TraceResult;
  preferences: Preferences;
  stale: boolean;
  onClose: () => void;
  toasts: ToastApi;
}

export function ExportDialog({
  source,
  result,
  preferences,
  stale,
  onClose,
  toasts,
}: ExportDialogProps) {
  const [format, setFormat] = useState<'svg' | 'png'>('svg');
  const [fileName, setFileName] = useState(() => exportBaseName(source.baseName));
  const [pngWidth, setPngWidth] = useState(String(result.width));
  const [pngTransparent, setPngTransparent] = useState(
    preferences.background === 'transparent',
  );
  const [pngBusy, setPngBusy] = useState(false);
  const [pngError, setPngError] = useState<string | null>(null);

  const svgExport = useMemo(
    () =>
      buildSvgDocument(
        { width: result.width, height: result.height, paths: result.paths },
        { background: preferences.background, backgroundColor: preferences.backgroundColor },
      ),
    [preferences.background, preferences.backgroundColor, result],
  );
  const svgBytes = useMemo(() => utf8ByteLength(svgExport), [svgExport]);

  const targetWidth = Math.max(1, Math.round(Number.parseInt(pngWidth, 10) || result.width));
  const targetHeight = Math.max(1, Math.round((targetWidth * result.height) / result.width));
  const pngLimit = validatePngDimensions(targetWidth, targetHeight);
  const pngBackground: BackgroundMode = pngTransparent
    ? 'transparent'
    : preferences.background === 'transparent'
      ? 'white'
      : preferences.background;

  const pngSvg = useMemo(
    () =>
      buildSvgDocument(
        { width: result.width, height: result.height, paths: result.paths },
        {
          background: pngBackground,
          backgroundColor: preferences.backgroundColor,
          width: targetWidth,
          height: targetHeight,
        },
      ),
    [
      pngBackground,
      preferences.backgroundColor,
      result,
      targetHeight,
      targetWidth,
    ],
  );

  const handleDownloadSvg = () => {
    downloadSvgFile(svgExport, fileNameWithExtension(fileName, 'svg'));
    toasts.show(de.export.downloadSuccess('SVG'), 'success');
  };

  const handleCopySvg = async () => {
    const copied = await copyText(svgExport);
    toasts.show(copied ? de.export.copySuccess : de.export.copyError, copied ? 'success' : 'error');
  };

  const handleDownloadPng = async () => {
    setPngError(null);
    if (pngLimit) {
      setPngError(de.export.pngTooLarge);
      return;
    }
    setPngBusy(true);
    try {
      await downloadPngFile(
        { svg: pngSvg, width: targetWidth, height: targetHeight },
        fileNameWithExtension(fileName, 'png'),
      );
      toasts.show(de.export.downloadSuccess('PNG'), 'success');
    } catch {
      setPngError(de.export.pngRenderError);
    } finally {
      setPngBusy(false);
    }
  };

  return (
    <Dialog
      title={de.export.title}
      description={de.export.description}
      onClose={onClose}
      className="dialog--export"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {de.export.close}
          </Button>
          <div className="dialog__footer-actions">
            {format === 'svg' ? (
              <Button
                variant="secondary"
                icon={<IconCopy size={15} stroke={1.8} />}
                onClick={() => void handleCopySvg()}
              >
                {de.actions.copySvg}
              </Button>
            ) : null}
            <Button
              variant="primary"
              icon={
                format === 'svg' ? (
                  <IconDownload size={16} stroke={1.8} />
                ) : (
                  <IconPhoto size={16} stroke={1.8} />
                )
              }
              onClick={format === 'svg' ? handleDownloadSvg : () => void handleDownloadPng()}
              disabled={pngBusy || (format === 'png' && pngLimit !== null)}
            >
              {pngBusy ? de.common.loading : format === 'svg' ? de.actions.downloadSvg : de.actions.downloadPng}
            </Button>
          </div>
        </>
      }
    >
      <div className="export-top">
        <Segmented
          fill
          label={de.export.format}
          value={format}
          onChange={(value) => setFormat(value)}
          options={[
            {
              value: 'svg',
              label: de.export.svg,
              icon: <IconVector size={15} stroke={1.7} />,
            },
            {
              value: 'png',
              label: de.export.png,
              icon: <IconPhoto size={15} stroke={1.7} />,
            },
          ]}
        />
        {stale ? (
          <div className="warning-note dialog-warning" role="status">
            <IconAlertTriangle size={15} stroke={1.9} aria-hidden="true" />
            <span>{de.export.exportStale}</span>
          </div>
        ) : null}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="export-filename">
          {de.export.filename}
        </label>
        <div className="input-with-suffix">
          <input
            id="export-filename"
            className="text-input"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            maxLength={80}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="numeric">.{format}</span>
        </div>
        <p className="field-hint">{de.export.filenameHint}</p>
      </div>

      {format === 'svg' ? (
        <div className="export-summary">
          <dl>
            <div>
              <dt>viewBox</dt>
              <dd className="numeric">
                0 0 {result.width} {result.height}
              </dd>
            </div>
            <div>
              <dt>{de.export.svgSummary}</dt>
              <dd className="numeric">
                {de.export.svgDetails(
                  formatCount(result.stats.pathCount),
                  formatCount(result.stats.colorCount),
                  formatBytes(svgBytes),
                )}
              </dd>
            </div>
          </dl>
          <p className="field-hint">
            {preferences.background === 'transparent'
              ? de.export.svgTransparent
              : de.export.svgIncludesBackground}
          </p>
        </div>
      ) : (
        <div className="png-options">
          <div className="png-row">
            <div className="field">
              <label className="field-label" htmlFor="png-width">
                {de.export.pngWidth}
              </label>
              <input
                id="png-width"
                type="number"
                className="text-input numeric"
                min={1}
                max={8192}
                inputMode="numeric"
                value={pngWidth}
                onChange={(event) => setPngWidth(event.target.value)}
              />
            </div>
            <div className="field">
              <span className="field-label">{de.export.pngHeight}</span>
              <output className="text-input output-readonly numeric">
                {Number.isFinite(targetHeight) ? targetHeight : '–'}
              </output>
            </div>
          </div>

          <div className="scale-buttons" role="group" aria-label={de.export.pngScale}>
            {[1, 2, 4].map((factor) => (
              <button
                key={factor}
                type="button"
                className="scale-button"
                onClick={() => setPngWidth(String(result.width * factor))}
              >
                {factor}×
              </button>
            ))}
            <span className="field-hint numeric">
              {de.export.pngSizeInfo(targetWidth, targetHeight)}
            </span>
          </div>

          <Switch
            checked={pngTransparent}
            onChange={setPngTransparent}
            label={de.export.pngTransparent}
            description={de.export.pngTransparentHint}
          />

          {pngLimit ? (
            <p className="inline-field-error">{de.export.pngTooLarge}</p>
          ) : (
            <p className="field-hint">{de.export.pngLimit}</p>
          )}
          {pngError ? (
            <p className="inline-field-error" role="alert">
              {pngError}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
