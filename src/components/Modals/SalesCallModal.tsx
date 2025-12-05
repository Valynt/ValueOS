/**
 * Sales Call Modal
 * 
 * Upload and analyze sales call recordings.
 * Transcribes with Whisper, analyzes with Together.ai.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  X,
  Mic,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  Play,
  Clock,
  Target,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Lightbulb,
  DollarSign,
  Calendar,
} from 'lucide-react';
import {
  callAnalysisService,
  CallAnalysis,
  TranscriptionResult,
} from '../../services/CallAnalysisService';

// ============================================================================
// Types
// ============================================================================

interface SalesCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (analysis: CallAnalysis, transcript: string) => void;
}

type AnalysisState = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'complete' | 'error';

// ============================================================================
// Component
// ============================================================================

export const SalesCallModal: React.FC<SalesCallModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  // Handle Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  
  // Results
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File validation
  const validateFile = (file: File): string | null => {
    const validExtensions = ['.mp3', '.mp4', '.m4a', '.wav', '.webm', '.ogg'];
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(extension)) {
      return `Invalid file type. Supported: ${validExtensions.join(', ')}`;
    }
    
    if (file.size > 25 * 1024 * 1024) {
      return 'File too large. Maximum size is 25MB.';
    }
    
    return null;
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setSelectedFile(file);
    setError(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // Process the audio file
  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setError(null);
    setAnalysisState('uploading');
    setProgress(10);

    try {
      // Step 1: Transcribe
      setAnalysisState('transcribing');
      setProgress(30);
      
      const transcriptionResult = await callAnalysisService.transcribe(selectedFile);
      setTranscription(transcriptionResult);
      setProgress(60);

      // Step 2: Analyze
      setAnalysisState('analyzing');
      setProgress(80);
      
      const analysisResult = await callAnalysisService.analyzeTranscript(
        transcriptionResult.transcript,
        transcriptionResult.duration
      );
      setAnalysis(analysisResult);
      setProgress(100);
      
      setAnalysisState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setAnalysisState('error');
    }
  };

  // Use the analysis
  const handleUseAnalysis = () => {
    if (analysis && transcription) {
      onComplete(analysis, transcription.transcript);
    }
  };

  // Reset state
  const resetState = useCallback(() => {
    setSelectedFile(null);
    setAnalysisState('idle');
    setProgress(0);
    setError(null);
    setTranscription(null);
    setAnalysis(null);
    setDragOver(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-call-title"
    >
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl m-4 border border-gray-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="sales-call-title" className="text-xl font-semibold text-gray-900">Analyze Sales Call</h2>
              <p className="text-sm text-gray-400">Upload a recording for AI analysis</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {analysisState === 'idle' || analysisState === 'error' ? (
            <div className="space-y-6">
              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-green-500 bg-green-500/10'
                    : selectedFile
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.mp4,.m4a,.wav,.webm,.ogg,audio/*,video/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    </div>
                    <p className="text-white font-medium">{selectedFile.name}</p>
                    <p className="text-gray-400 text-sm">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="text-gray-400 text-sm hover:text-white"
                    >
                      Choose different file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        Drop your recording here
                      </p>
                      <p className="text-gray-400 text-sm">
                        or click to browse
                      </p>
                    </div>
                    <p className="text-gray-500 text-xs">
                      Supports MP3, MP4, M4A, WAV, WebM • Max 25MB
                    </p>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Info */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h4 className="text-white font-medium mb-2">What you'll get:</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    Full transcript
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Target className="w-4 h-4 text-purple-400" />
                    Pain points identified
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    Objections & responses
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Call score & coaching
                  </div>
                </div>
              </div>
            </div>
          ) : analysisState === 'complete' && analysis ? (
            <AnalysisResults 
              analysis={analysis} 
              transcription={transcription}
            />
          ) : (
            <ProcessingState 
              state={analysisState} 
              progress={progress}
              fileName={selectedFile?.name}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800 flex-shrink-0">
          {analysisState === 'complete' ? (
            <>
              <button
                onClick={() => {
                  setAnalysisState('idle');
                  setAnalysis(null);
                  setTranscription(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                ← Analyze Another
              </button>
              <button
                onClick={handleUseAnalysis}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Use This Analysis
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-sm">
                {selectedFile 
                  ? 'Ready to transcribe and analyze'
                  : 'Upload a sales call recording'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={!selectedFile || analysisState !== 'idle' && analysisState !== 'error'}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Analyze Call
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Processing State Component
// ============================================================================

interface ProcessingStateProps {
  state: AnalysisState;
  progress: number;
  fileName?: string;
}

const ProcessingState: React.FC<ProcessingStateProps> = ({ state, progress, fileName }) => {
  const getMessage = () => {
    switch (state) {
      case 'uploading':
        return 'Uploading audio file...';
      case 'transcribing':
        return 'Transcribing with Whisper AI...';
      case 'analyzing':
        return 'Analyzing call with AI...';
      default:
        return 'Processing...';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative mb-6">
        <Loader2 className="w-16 h-16 text-green-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-medium text-sm">{progress}%</span>
        </div>
      </div>
      <p className="text-white font-medium mb-2">{getMessage()}</p>
      {fileName && (
        <p className="text-gray-400 text-sm">{fileName}</p>
      )}
      <div className="w-64 h-2 bg-gray-800 rounded-full mt-4 overflow-hidden">
        <div 
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Analysis Results Component
// ============================================================================

interface AnalysisResultsProps {
  analysis: CallAnalysis;
  transcription: TranscriptionResult | null;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysis, transcription }) => {
  const [showTranscript, setShowTranscript] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-green-500/20';
    if (score >= 6) return 'bg-yellow-500/20';
    return 'bg-red-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Summary & Score */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-white font-medium mb-2">Call Summary</h3>
          <p className="text-gray-300">{analysis.summary}</p>
        </div>
        
        <div className={`rounded-xl p-4 ${getScoreBg(analysis.callScore)} border border-gray-700`}>
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Call Score</p>
            <p className={`text-4xl font-bold ${getScoreColor(analysis.callScore)}`}>
              {analysis.callScore}/10
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-gray-400 text-xs">Duration</span>
          </div>
          <p className="text-white font-medium">
            {callAnalysisService.formatDuration(analysis.duration)}
          </p>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-gray-400 text-xs">Pricing</span>
          </div>
          <p className="text-white font-medium">
            {analysis.pricingDiscussed ? 'Discussed' : 'Not discussed'}
          </p>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-purple-400" />
            <span className="text-gray-400 text-xs">Budget</span>
          </div>
          <p className="text-white font-medium">
            {analysis.budgetMentioned ? 'Mentioned' : 'Not mentioned'}
          </p>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-orange-400" />
            <span className="text-gray-400 text-xs">Timeline</span>
          </div>
          <p className="text-white font-medium">
            {analysis.timelineMentioned ? 'Mentioned' : 'Not mentioned'}
          </p>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h4 className="text-white font-medium mb-3">Score Breakdown</h4>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(analysis.scoreBreakdown).map(([key, score]) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <span className="text-gray-400 text-xs capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className={`text-xs font-medium ${getScoreColor(score)}`}>
                  {score}/10
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${score >= 8 ? 'bg-green-500' : score >= 6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${score * 10}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pain Points */}
        {analysis.painPoints.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-purple-400" />
              <h4 className="text-white font-medium">Pain Points</h4>
            </div>
            <ul className="space-y-2">
              {analysis.painPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                  <span className="text-purple-400 mt-0.5">•</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Objections */}
        {analysis.objections.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <h4 className="text-white font-medium">Objections</h4>
            </div>
            <ul className="space-y-3">
              {analysis.objections.map((obj, i) => (
                <li key={i} className="text-sm">
                  <p className="text-gray-300">"{obj.objection}"</p>
                  {obj.response && (
                    <p className="text-gray-500 mt-1">→ {obj.response}</p>
                  )}
                  <span className={`text-xs ${obj.handled ? 'text-green-400' : 'text-red-400'}`}>
                    {obj.handled ? '✓ Handled' : '✗ Not handled'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Buying Signals & Warning Flags */}
      <div className="grid grid-cols-2 gap-4">
        {analysis.buyingSignals.length > 0 && (
          <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h4 className="text-green-400 font-medium">Buying Signals</h4>
            </div>
            <ul className="space-y-2">
              {analysis.buyingSignals.map((signal, i) => (
                <li key={i} className="flex items-start gap-2 text-green-300 text-sm">
                  <CheckCircle className="w-3 h-3 mt-1 flex-shrink-0" />
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.warningFlags.length > 0 && (
          <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <h4 className="text-red-400 font-medium">Warning Flags</h4>
            </div>
            <ul className="space-y-2">
              {analysis.warningFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-red-300 text-sm">
                  <AlertCircle className="w-3 h-3 mt-1 flex-shrink-0" />
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Coaching Tips */}
      {analysis.coachingTips.length > 0 && (
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-blue-400" />
            <h4 className="text-blue-400 font-medium">Coaching Tips</h4>
          </div>
          <ul className="space-y-2">
            {analysis.coachingTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-blue-300 text-sm">
                <span className="text-blue-400 mt-0.5">→</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transcript Toggle */}
      {transcription && (
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full p-4 flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 transition-colors"
          >
            <span className="text-white font-medium">Full Transcript</span>
            <span className="text-gray-400 text-sm">
              {showTranscript ? 'Hide' : 'Show'}
            </span>
          </button>
          {showTranscript && (
            <div className="p-4 bg-gray-900 max-h-64 overflow-y-auto">
              <p className="text-gray-300 text-sm whitespace-pre-wrap font-mono">
                {transcription.transcript}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SalesCallModal;
