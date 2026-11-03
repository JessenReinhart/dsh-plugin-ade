import { useEffect, useRef } from 'react';
import type { SplitZone } from '../components/types.js';

export interface KeyboardShortcutHandlers {
  paneCount: number;
  onFocusPane: (index: number) => void;
  onSplit: (direction: SplitZone) => void;
  onClose: () => void;
  onMaximize: () => void;
  onToggleBroadcast: () => void;
}

const ARROW_TO_ZONE: Record<string, SplitZone> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'top',
  ArrowDown: 'bottom',
};

/**
 * Registers the ADE keyboard map:
 *   Alt+1..9       focus pane by traversal index
 *   Alt+Shift+←→↑↓ split active pane toward that edge
 *   Alt+W          close active pane
 *   Alt+M          maximize active pane
 *   Alt+B          toggle broadcast
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) {
        return;
      }

      const key = e.key;

      if (key >= '1' && key <= '9') {
        const index = Number(key) - 1;
        if (index < ref.current.paneCount) {
          e.preventDefault();
          ref.current.onFocusPane(index);
        }
        return;
      }

      if (e.shiftKey && key in ARROW_TO_ZONE) {
        e.preventDefault();
        ref.current.onSplit(ARROW_TO_ZONE[key]);
        return;
      }

      switch (key.toLowerCase()) {
        case 'w':
          e.preventDefault();
          ref.current.onClose();
          break;
        case 'm':
          e.preventDefault();
          ref.current.onMaximize();
          break;
        case 'b':
          e.preventDefault();
          ref.current.onToggleBroadcast();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}