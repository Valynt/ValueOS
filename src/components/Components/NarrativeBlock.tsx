import React, { useState } from 'react';
import { NarrativeBlockProps } from '../../types';
import { FileText, CreditCard as Edit3, Check, X } from 'lucide-react';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

export const NarrativeBlock: React.FC<NarrativeBlockProps> = ({
  title,
  content,
  isEditable
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const startEditing = () => {
    if (!isEditable) return;
    setIsEditing(true);
    setEditContent(content);
  };

  const saveChanges = () => {
    setIsEditing(false);
    // In a real app, this would update the parent component's state
  };

  const cancelChanges = () => {
    setIsEditing(false);
    setEditContent(content);
  };

  const renderMarkdown = (text: string) => {
    const rendered = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return sanitizeHtml(rendered);
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        
        {isEditable && !isEditing && (
          <button
            onClick={startEditing}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        )}
        
        {isEditing && (
          <div className="flex items-center space-x-2">
            <button
              onClick={saveChanges}
              className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancelChanges}
              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      
      {isEditing ? (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm leading-relaxed"
          placeholder="Enter your narrative content..."
        />
      ) : (
        <div 
          className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}
      
      {!isEditing && isEditable && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={startEditing}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Click to edit narrative
          </button>
        </div>
      )}
    </div>
  );
};