/**
 * NarrativeBlock Component
 * 
 * Displays AI-generated narrative content with optional editing and transparency.
 * Used for agent responses, summaries, and explanatory text.
 */

import React, { useState } from 'react';
import { Edit, Check, X, Sparkles, Brain, ChevronDown, ChevronUp } from 'lucide-react';

export interface NarrativeBlockProps {
  title: string;
  content: string;
  isEditable?: boolean;
  agentName?: string;
  confidence?: number;
  reasoning?: string[];
  sources?: string[];
  onContentChange?: (newContent: string) => void;
  className?: string;
}

export const NarrativeBlock: React.FC<NarrativeBlockProps> = ({
  title,
  content,
  isEditable = false,
  agentName,
  confidence,
  reasoning,
  sources,
  onContentChange,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showReasoning, setShowReasoning] = useState(false);

  const handleSave = () => {
    onContentChange?.(editedContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  const getConfidenceColor = (level: number) => {
    if (level >= 0.8) return 'text-green-600 bg-green-50';
    if (level >= 0.5) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceLabel = (level: number) => {
    if (level >= 0.8) return 'High';
    if (level >= 0.5) return 'Medium';
    return 'Low';
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {agentName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                {agentName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {confidence !== undefined && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(confidence)}`}>
                {getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
              </span>
            )}
            {isEditable && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y min-h-[120px]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {content}
          </div>
        )}
      </div>

      {/* Reasoning Section */}
      {reasoning && reasoning.length > 0 && (
        <div className="border-t border-gray-200">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-500" />
              <span>AI Reasoning ({reasoning.length} steps)</span>
            </div>
            {showReasoning ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showReasoning && (
            <div className="px-4 py-3 bg-gray-50 space-y-2">
              {reasoning.map((step, index) => (
                <div key={index} className="flex gap-2 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="text-gray-600">{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sources Section */}
      {sources && sources.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Sources:</p>
          <div className="flex flex-wrap gap-1">
            {sources.map((source, index) => (
              <span
                key={index}
                className="inline-block px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600 hover:text-indigo-600 cursor-pointer"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NarrativeBlock;
