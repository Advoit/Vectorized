import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconDownload,
  IconFolderOpen,
  IconInfoCircle,
} from '@tabler/icons-react';
import { de } from '../i18n/de';
import { BrandMark } from './BrandMark';
import { Button } from './Button';
import { IconButton } from './IconButton';

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
  return (
    <header className="app-header">
      <div className="brand">
        <BrandMark />
        <span className="brand__name">{de.product.name}</span>
        <span className="brand__tagline">{de.product.tagline}</span>
      </div>

      <div className="header-actions">
        <Button
          variant="secondary"
          icon={<IconFolderOpen size={16} stroke={1.7} aria-hidden="true" />}
          onClick={onOpen}
          aria-label={hasImage ? de.header.newImage : de.header.open}
          aria-keyshortcuts="Control+O Meta+O"
          className="header-open"
        >
          <span className="btn__label">{hasImage ? de.header.newImage : de.header.open}</span>
        </Button>

        <span className="header-divider" aria-hidden="true" />

        <IconButton
          label={canUndo ? `${de.header.undo} (${de.shortcuts.undo})` : de.header.undoDisabled}
          icon={<IconArrowBackUp size={17} stroke={1.7} />}
          onClick={onUndo}
          disabled={!canUndo}
        />
        <IconButton
          label={canRedo ? `${de.header.redo} (${de.shortcuts.redo})` : de.header.redoDisabled}
          icon={<IconArrowForwardUp size={17} stroke={1.7} />}
          onClick={onRedo}
          disabled={!canRedo}
        />

        <span className="header-divider header-divider--optional" aria-hidden="true" />

        <IconButton
          label={de.header.info}
          icon={<IconInfoCircle size={17} stroke={1.7} />}
          onClick={onInfo}
        />

        <Button
          variant="primary"
          icon={<IconDownload size={16} stroke={1.8} aria-hidden="true" />}
          onClick={onExport}
          disabled={!canExport}
          title={canExport ? undefined : de.header.exportDisabled}
          aria-label={de.header.export}
          aria-keyshortcuts="Control+E Meta+E"
          className="header-export"
        >
          <span className="btn__label">{de.header.export}</span>
        </Button>
      </div>
    </header>
  );
}
