import { useEffect, useRef } from 'react';

export interface ShortcutActions {
  onOpen: () => void;
  onExport: () => void;
  onTrace: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  onActualSize: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color'].includes(type);
  }
  return false;
}

export function useShortcuts(actions: ShortcutActions, enabled: boolean): void {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (isTextEntry(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const actionsCurrent = actionsRef.current;

      if (mod && key === 'o') {
        event.preventDefault();
        actionsCurrent.onOpen();
      } else if (mod && key === 'e') {
        event.preventDefault();
        actionsCurrent.onExport();
      } else if (mod && key === 'enter') {
        event.preventDefault();
        actionsCurrent.onTrace();
      } else if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) actionsCurrent.onRedo();
        else actionsCurrent.onUndo();
      } else if (mod && key === 'y') {
        event.preventDefault();
        actionsCurrent.onRedo();
      } else if (!mod && !event.altKey) {
        if (key === '0') {
          event.preventDefault();
          actionsCurrent.onFit();
        } else if (key === '1') {
          event.preventDefault();
          actionsCurrent.onActualSize();
        } else if (key === '+' || key === '=') {
          event.preventDefault();
          actionsCurrent.onZoomIn();
        } else if (key === '-') {
          event.preventDefault();
          actionsCurrent.onZoomOut();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}
