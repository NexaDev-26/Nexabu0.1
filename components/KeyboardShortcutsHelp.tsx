/**
 * Keyboard Shortcuts Help Modal
 * Displays available keyboard shortcuts
 */

import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
  title?: string;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  shortcuts,
  title = 'Keyboard Shortcuts'
}) => {
  if (!isOpen) return null;

  const formatKey = (shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    if (shortcut.ctrlKey || shortcut.metaKey) parts.push('Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    parts.push(shortcut.key === 'Escape' ? 'Esc' : shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.description?.includes('search') ? 'Navigation' :
                    shortcut.description?.includes('Create') || shortcut.description?.includes('new') ? 'Actions' :
                    shortcut.description?.includes('Save') ? 'Editing' :
                    shortcut.description?.includes('Close') || shortcut.description?.includes('modal') ? 'General' :
                    'Other';
    
    if (!acc[category]) acc[category] = [];
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Keyboard className="w-6 h-6 text-orange-600" />
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {Object.keys(groupedShortcuts).length === 0 ? (
            <p className="text-neutral-500 text-center py-8">No keyboard shortcuts available</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                <div key={category}>
                  <h3 className="font-semibold text-neutral-700 dark:text-neutral-300 mb-3 uppercase text-xs tracking-wide">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {shortcut.description || 'No description'}
                        </span>
                        <kbd className="px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-sm">
                          {formatKey(shortcut)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
          <p className="text-xs text-neutral-500 text-center">
            Press <kbd className="px-2 py-0.5 text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
};
