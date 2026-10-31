import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconDownload,
  IconFolderOpen,
  IconInfoCircle,
} from '@tabler/icons-react';
import { LOCALES, LOCALE_META, useLocale, useMessages } from '../i18n';
import { BrandMark } from './BrandMark';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Segmented } from './Segmented';

interface HeaderProps {
  hasImage: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  onOpen: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onInfo: () => void;
}

export function Header({
  hasImage,
  canUndo,
  canRedo,
  canExport,
  onOpen,
  onUndo,
  onRedo,
  onExport,
  onInfo,
}: HeaderProps) {
  const m = useMessages();
  const { locale, setLocale } = useLocale();

  return (
    <header className="app-header">
      <div className="brand">
        <BrandMark />
        <span className="brand__name">{m.product.name}</span>
        <span className="brand__tagline">{m.product.tagline}</span>
      </div>

      <div className="header-actions">
        <Button
          variant="secondary"
          icon={<IconFolderOpen size={16} stroke={1.7} aria-hidden="true" />}
          onClick={onOpen}
          aria-label={hasImage ? m.header.newImage : m.header.open}
          aria-keyshortcuts="Control+O Meta+O"
          className="header-open"
        >
          <span className="btn__label">{hasImage ? m.header.newImage : m.header.open}</span>
        </Button>

        <span className="header-divider" aria-hidden="true" />

        <IconButton
          label={canUndo ? `${m.header.undo} (${m.shortcuts.undo})` : m.header.undoDisabled}
          icon={<IconArrowBackUp size={17} stroke={1.7} />}
          onClick={onUndo}
          disabled={!canUndo}
        />
        <IconButton
          label={canRedo ? `${m.header.redo} (${m.shortcuts.redo})` : m.header.redoDisabled}
          icon={<IconArrowForwardUp size={17} stroke={1.7} />}
          onClick={onRedo}
          disabled={!canRedo}
        />

        <span className="header-divider header-divider--optional" aria-hidden="true" />

        <IconButton
          label={m.header.info}
          icon={<IconInfoCircle size={17} stroke={1.7} />}
          onClick={onInfo}
        />

        <div className="header-lang">
          <Segmented
            value={locale}
            label={m.header.language}
            onChange={setLocale}
            options={LOCALES.map((value) => ({
              value,
              label: LOCALE_META[value].short,
              ariaLabel: LOCALE_META[value].name,
            }))}
          />
        </div>

        <Button
          variant="primary"
          icon={<IconDownload size={16} stroke={1.8} aria-hidden="true" />}
          onClick={onExport}
          disabled={!canExport}
          title={canExport ? undefined : m.header.exportDisabled}
          aria-label={m.header.export}
          aria-keyshortcuts="Control+E Meta+E"
          className="header-export"
        >
          <span className="btn__label">{m.header.export}</span>
        </Button>
      </div>
    </header>
  );
}
