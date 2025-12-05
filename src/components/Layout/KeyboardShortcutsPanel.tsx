import React from 'react';
import { X, Command } from 'lucide-react';

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

export const KeyboardShortcutsPanel: React.FC<KeyboardShortcutsPanelProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const shortcuts: Shortcut[] = [
    { keys: ['⌘', 'K'], description: 'Open command bar', category: 'General' },
    { keys: ['⌘', 'Z'], description: 'Undo', category: 'General' },
    { keys: ['⌘', '⇧', 'Z'], description: 'Redo', category: 'General' },
    { keys: ['⌘', 'S'], description: 'Save (auto-saved)', category: 'General' },
    { keys: ['⌘', 'D'], description: 'Duplicate component', category: 'Components' },
    { keys: ['⌫'], description: 'Delete selected', category: 'Components' },
    { keys: ['⌘', 'A'], description: 'Select all', category: 'Components' },
    { keys: ['Esc'], description: 'Deselect all', category: 'Components' },
    { keys: ['⌘', '←'], description: 'Align left', category: 'Layout' },
    { keys: ['⌘', '→'], description: 'Align right', category: 'Layout' },
    { keys: ['⌘', '↑'], description: 'Align top', category: 'Layout' },
    { keys: ['⌘', '↓'], description: 'Align bottom', category: 'Layout' },
    { keys: ['?'], description: 'Show shortcuts', category: 'Help' },
  ];

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-30 z-50" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl">
        <div className="bg-white rounded-xl shadow-2xl max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Command className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h2>
                <p className="text-sm text-gray-600">Work faster with keyboard commands</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
            <div className="space-y-6">
              {categories.map(category => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts
                      .filter(s => s.category === category)
                      .map((shortcut, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <span className="text-sm text-gray-700">{shortcut.description}</span>
                          <div className="flex items-center space-x-1">
                            {shortcut.keys.map((key, keyIndex) => (
                              <React.Fragment key={keyIndex}>
                                <kbd className="px-2.5 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-semibold text-gray-700 shadow-sm">
                                  {key}
                                </kbd>
                                {keyIndex < shortcut.keys.length - 1 && (
                                  <span className="text-gray-400">+</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs">?</kbd> anytime to show this panel
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
