import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Loader2, MessageCircle, Send } from 'lucide-react';
import { analyticsClient } from '../../lib/analyticsClient';
import { getConsoleLogs } from '../../utils/consoleRecorder';

const DEFAULT_BETA_HUB_URL = import.meta.env.VITE_BETA_HUB_URL || 'https://docs.valuecanvas.app/beta-hub';

type CaptureStatus = 'idle' | 'capturing' | 'ready' | 'error';

export const BetaFeedbackWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>('idle');
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState<'issue' | 'idea' | 'praise'>('issue');
  const [includeLogs, setIncludeLogs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const browserInfo = useMemo(() => {
    if (typeof navigator === 'undefined') return 'unknown';
    return navigator.userAgent;
  }, []);

  const captureScreenshot = useCallback(async () => {
    try {
      setCaptureStatus('capturing');
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, { useCORS: true, logging: false, scale: 0.8 });
      setScreenshot(canvas.toDataURL('image/png'));
      setCaptureStatus('ready');
    } catch (error) {
      console.error('Screenshot capture failed', error);
      setCaptureStatus('error');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      captureScreenshot();
      analyticsClient.track('feedback_widget_opened', {
        workflow: 'beta_feedback',
        browser: browserInfo,
      });
    }
  }, [browserInfo, captureScreenshot, isOpen]);

  const resetForm = () => {
    setSummary('');
    setSeverity('issue');
    setIncludeLogs(true);
    setScreenshot(null);
    setCaptureStatus('idle');
  };

  const submitFeedback = async () => {
    setIsSubmitting(true);
    analyticsClient.trackFeedback({
      summary,
      severity,
      includeConsoleLogs: includeLogs,
      screenshotIncluded: Boolean(screenshot),
    });

    analyticsClient.track('support_ticket_queued', {
      tags: ['beta_cohort', 'priority_high'],
      severity,
      console_log_count: includeLogs ? getConsoleLogs().length : 0,
      browser: browserInfo,
      has_screenshot: Boolean(screenshot),
      workflow: 'beta_feedback',
    });

    setToast('Thanks! We routed this to the beta support queue.');
    setIsSubmitting(false);
    setIsOpen(false);
    resetForm();
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg z-50" role="alert">
          <p className="text-sm">{toast}</p>
          <button
            onClick={() => setToast(null)}
            className="text-xs text-blue-200 underline mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
        aria-label="Send beta feedback"
      >
        <MessageCircle className="w-4 h-4" />
        Feedback
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Submit feedback"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold">Beta Support</p>
                <h3 className="text-xl font-semibold text-gray-900">Submit in-app feedback</h3>
                <p className="text-sm text-gray-500">We capture a screenshot, browser details, and console logs to speed up triage.</p>
              </div>
              <a
                href={DEFAULT_BETA_HUB_URL}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Beta Hub
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="What happened?"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="block text-sm font-medium text-gray-700">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as typeof severity)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="issue">Issue</option>
                    <option value="idea">Idea</option>
                    <option value="praise">Praise</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="include-logs"
                    type="checkbox"
                    checked={includeLogs}
                    onChange={(e) => setIncludeLogs(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="include-logs" className="text-sm text-gray-700">Attach console logs</label>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>Browser: {browserInfo}</p>
                  <p>Console entries: {includeLogs ? getConsoleLogs().length : 0}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Screenshot</p>
                  <button
                    onClick={captureScreenshot}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Camera className="w-4 h-4" />
                    Re-capture
                  </button>
                </div>
                <div className="border border-dashed border-gray-300 rounded-lg h-64 flex items-center justify-center bg-gray-50 overflow-hidden">
                  {captureStatus === 'capturing' && (
                    <div className="flex flex-col items-center text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mb-2" />
                      <p className="text-sm">Capturing current view...</p>
                    </div>
                  )}
                  {captureStatus === 'ready' && screenshot && (
                    <img src={screenshot} alt="Screenshot preview" className="object-contain h-full w-full" />
                  )}
                  {captureStatus === 'error' && (
                    <p className="text-sm text-red-600 px-4 text-center">Unable to capture screenshot. Try again or include steps manually.</p>
                  )}
                  {captureStatus === 'idle' && (
                    <p className="text-sm text-gray-500">Preparing capture...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Tagged for <span className="font-semibold text-gray-700">beta_cohort</span> with 24h SLA.
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setIsOpen(false); resetForm(); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={submitFeedback}
                  disabled={isSubmitting || !summary.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
