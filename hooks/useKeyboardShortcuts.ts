/**
 * Keyboard Shortcuts Hook
 * Manages global and contextual keyboard shortcuts
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description?: string;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const matchingShortcut = shortcuts.find((shortcut) => {
        const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey === undefined ? true : shortcut.ctrlKey === (event.ctrlKey || event.metaKey);
        const shiftMatch = shortcut.shiftKey === undefined ? true : shortcut.shiftKey === event.shiftKey;
        const altMatch = shortcut.altKey === undefined ? true : shortcut.altKey === event.altKey;
        const metaMatch = shortcut.metaKey === undefined ? true : shortcut.metaKey === event.metaKey;

        return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch;
      });

      if (matchingShortcut) {
        if (matchingShortcut.preventDefault !== false) {
          event.preventDefault();
        }
        matchingShortcut.action();
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown, enabled]);
}

/**
 * Common keyboard shortcuts for the app
 */
export const createGlobalShortcuts = (actions: {
  onSearch?: () => void;
  onNew?: () => void;
  onSave?: () => void;
  onClose?: () => void;
  onHelp?: () => void;
}): KeyboardShortcut[] => {
  const shortcuts: KeyboardShortcut[] = [];

  if (actions.onSearch) {
    shortcuts.push({
      key: 'k',
      ctrlKey: true,
      action: actions.onSearch,
      description: 'Open search'
    });
  }

  if (actions.onNew) {
    shortcuts.push({
      key: 'n',
      ctrlKey: true,
      action: actions.onNew,
      description: 'Create new item'
    });
  }

  if (actions.onSave) {
    shortcuts.push({
      key: 's',
      ctrlKey: true,
      action: actions.onSave,
      description: 'Save'
    });
  }

  if (actions.onClose) {
    shortcuts.push({
      key: 'Escape',
      action: actions.onClose,
      description: 'Close modal/dialog'
    });
  }

  if (actions.onHelp) {
    shortcuts.push({
      key: '/',
      ctrlKey: true,
      action: actions.onHelp,
      description: 'Show keyboard shortcuts'
    });
  }

  return shortcuts;
};
