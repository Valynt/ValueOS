import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Move,
  Maximize2,
  Edit3,
  Sparkles
} from 'lucide-react';

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  position: { x: number; y: number };
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  actions,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 py-2 z-50 min-w-56 animate-fade-in"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          {action.separator && <div className="h-px bg-gray-200 my-2" />}
          <button
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm transition-colors ${
              action.danger
                ? 'text-red-700 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className={action.danger ? 'text-red-600' : 'text-gray-500'}>
              {action.icon}
            </span>
            <span className="font-medium">{action.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export const getDefaultComponentActions = (
  componentId: string,
  onDuplicate: () => void,
  onDelete: () => void,
  onAlignLeft: () => void,
  onAlignCenter: () => void,
  onAlignRight: () => void,
  onAskAgent: () => void
): ContextMenuAction[] => [
  {
    id: 'ask-agent',
    label: 'Ask Agent to Refine',
    icon: <Sparkles className="h-4 w-4" />,
    onClick: onAskAgent
  },
  {
    id: 'edit',
    label: 'Edit Properties',
    icon: <Edit3 className="h-4 w-4" />,
    onClick: () => {}
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    icon: <Copy className="h-4 w-4" />,
    onClick: onDuplicate,
    separator: true
  },
  {
    id: 'align-left',
    label: 'Align Left',
    icon: <AlignLeft className="h-4 w-4" />,
    onClick: onAlignLeft
  },
  {
    id: 'align-center',
    label: 'Align Center',
    icon: <AlignCenter className="h-4 w-4" />,
    onClick: onAlignCenter
  },
  {
    id: 'align-right',
    label: 'Align Right',
    icon: <AlignRight className="h-4 w-4" />,
    onClick: onAlignRight
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="h-4 w-4" />,
    onClick: onDelete,
    danger: true,
    separator: true
  }
];
