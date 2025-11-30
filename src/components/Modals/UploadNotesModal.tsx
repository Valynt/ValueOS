/**
 * Upload Notes Modal
 * 
 * Allows users to upload or paste opportunity notes (PDF, DOCX, TXT, or raw text).
 * Extracts content and creates a value case with AI-generated insights.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { ProgressBar, StepProgress } from '../Common/ProgressBar';
import { documentParserService, ExtractedInsights } from '../../services/DocumentParserService';

interface UploadNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (notes: ExtractedNotes) => void;
  initialFile?: File | null;
}

export interface ExtractedNotes {
  rawText: string;
  fileName?: string;
  fileType?: string;
  insights?: ExtractedInsights;
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export const UploadNotesModal: React.FC<UploadNotesModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialFile,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedInitialFileKey = useRef<string | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|docx?|txt|md)$/i)) {
      setError('Please upload a PDF, Word document, or text file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB');
      return;
    }

    setFile(file);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    
    let textContent = '';
    let fileName: string | undefined;
    let fileType: string | undefined;
    let insights: ExtractedInsights | undefined;

    if (activeTab === 'paste') {
      if (!pastedText.trim()) {
        setError('Please paste some text');
        return;
      }
      textContent = pastedText.trim();
      
      setUploadState('processing');
      
      try {
        // Use LLM to extract insights from pasted text
        insights = await documentParserService.extractInsights(textContent);
      } catch (err) {
        console.error('Insight extraction failed:', err);
        // Continue without insights if extraction fails
      }
    } else {
      if (!selectedFile) {
        setError('Please select a file');
        return;
      }
      
      setUploadState('uploading');
      fileName = selectedFile.name;
      fileType = selectedFile.type;
      
      try {
        // Parse document and extract insights using the service
        const result = await documentParserService.parseAndExtract(selectedFile);
        textContent = result.document.text;
        insights = result.insights;
        
        setUploadState('processing');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process document');
        setUploadState('error');
        return;
      }
    }

    setUploadState('success');

    // Small delay to show success state
    setTimeout(() => {
      onComplete({
        rawText: textContent,
        fileName,
        fileType,
        insights,
      });
    }, 500);
  };

  const resetState = () => {
    setSelectedFile(null);
    setPastedText('');
    setUploadState('idle');
    setError(null);
    setActiveTab('upload');
    appliedInitialFileKey.current = null;
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  useEffect(() => {
    if (!isOpen || !initialFile) return;

    const fileKey = `${initialFile.name}-${initialFile.size}-${initialFile.lastModified}`;
    if (appliedInitialFileKey.current === fileKey) return;

    handleFileSelect(initialFile);
    appliedInitialFileKey.current = fileKey;
  }, [isOpen, initialFile, handleFileSelect]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-notes-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Upload Notes</h2>
              <p className="text-sm text-gray-400">Import opportunity notes or meeting summaries</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-white border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'paste'
                ? 'text-white border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Paste Text
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'upload' ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center transition-all
                ${dragOver 
                  ? 'border-indigo-500 bg-indigo-500/10' 
                  : 'border-gray-700 hover:border-gray-600'
                }
                ${selectedFile ? 'bg-gray-800/50' : ''}
              `}
            >
              {selectedFile ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{selectedFile.name}</p>
                    <p className="text-gray-500 text-sm">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Remove and choose another
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Drop your file here</p>
                    <p className="text-gray-500 text-sm mt-1">
                      or click to browse
                    </p>
                  </div>
                  <p className="text-gray-600 text-xs">
                    Supports PDF, Word (.docx), and text files up to 10MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    aria-label="Choose file to upload"
                  >
                    Choose File
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your meeting notes, call summary, or opportunity details here..."
                className="w-full h-64 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
              <p className="text-gray-500 text-xs">
                {pastedText.length} characters
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800">
          <p className="text-gray-500 text-sm">
            AI will extract key insights automatically
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Cancel upload"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={uploadState === 'uploading' || uploadState === 'processing'}
              aria-busy={uploadState === 'uploading' || uploadState === 'processing'}
              aria-label={uploadState === 'uploading' ? 'Uploading file' : uploadState === 'processing' ? 'Analyzing notes' : 'Analyze notes'}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {uploadState === 'uploading' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Uploading...
                </>
              )}
              {uploadState === 'processing' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Analyzing...
                </>
              )}
              {uploadState === 'success' && (
                <>
                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                  Done!
                </>
              )}
              {(uploadState === 'idle' || uploadState === 'error') && 'Analyze Notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadNotesModal;
