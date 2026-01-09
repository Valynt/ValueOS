/**
 * Export Actions Component
 * Provides PDF, Excel export and email sharing functionality
 */

import React, { useState } from 'react';
import { CheckCircle2, FileDown, FileSpreadsheet, Loader2, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { logger } from '../../lib/logger';
import { useEmailShareTracking, useExportTracking } from '../../hooks/usePortalAnalytics';

export interface ExportActionsProps {
  valueCaseId: string;
  companyName: string;
  onExport?: (format: 'pdf' | 'excel') => void;
}

type ExportStatus = 'idle' | 'loading' | 'success' | 'error';

export function ExportActions({ valueCaseId, companyName, onExport }: ExportActionsProps) {
  const [pdfStatus, setPdfStatus] = useState<ExportStatus>('idle');
  const [excelStatus, setExcelStatus] = useState<ExportStatus>('idle');
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // Analytics tracking hooks
  const trackExport = useExportTracking();
  const trackEmailShare = useEmailShareTracking();

  const handlePdfExport = async () => {
    try {
      setPdfStatus('loading');
      logger.info('PDF export started', { valueCaseId });

      // Track export start
      trackExport('pdf', { valueCaseId, companyName, status: 'started' });

      // Simulate export (in production, call actual export service)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In production:
      // const response = await fetch(`/api/customer/export/pdf/${valueCaseId}`);
      // const blob = await response.blob();
      // downloadFile(blob, `${companyName}-value-report.pdf`);

      setPdfStatus('success');
      onExport?.('pdf');

      // Track export success
      trackExport('pdf', { valueCaseId, companyName, status: 'success' });

      // Reset status after 3 seconds
      setTimeout(() => setPdfStatus('idle'), 3000);
    } catch (error) {
      logger.error('PDF export failed', error as Error);
      setPdfStatus('error');
      
      // Track export failure
      trackExport('pdf', { 
        valueCaseId, 
        companyName, 
        status: 'error',
        errorMessage: (error as Error).message 
      });
      
      setTimeout(() => setPdfStatus('idle'), 3000);
    }
  };

  const handleExcelExport = async () => {
    try {
      setExcelStatus('loading');
      logger.info('Excel export started', { valueCaseId });

      // Track export start
      trackExport('excel', { valueCaseId, companyName, status: 'started' });

      // Simulate export
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In production:
      // const response = await fetch(`/api/customer/export/excel/${valueCaseId}`);
      // const blob = await response.blob();
      // downloadFile(blob, `${companyName}-metrics.xlsx`);

      setExcelStatus('success');
      onExport?.('excel');

      // Track export success
      trackExport('excel', { valueCaseId, companyName, status: 'success' });

      setTimeout(() => setExcelStatus('idle'), 3000);
    } catch (error) {
      logger.error('Excel export failed', error as Error);
      setExcelStatus('error');
      
      // Track export failure
      trackExport('excel', { 
        valueCaseId, 
        companyName, 
        status: 'error',
        errorMessage: (error as Error).message 
      });
      
      setTimeout(() => setExcelStatus('idle'), 3000);
    }
  };

  const handleEmailShare = () => {
    setEmailModalOpen(true);
    
    // Track email modal open
    trackEmailShare(0, { valueCaseId, companyName, action: 'modal_opened' });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Export & Share</h3>
          <p className="text-sm text-gray-500 mt-1">
            Download your value realization report or share with stakeholders
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PDF Export */}
        <ExportButton
          icon={FileDown}
          label="Download PDF"
          description="Executive summary report"
          status={pdfStatus}
          onClick={handlePdfExport}
        />

        {/* Excel Export */}
        <ExportButton
          icon={FileSpreadsheet}
          label="Download Excel"
          description="Detailed metrics data"
          status={excelStatus}
          onClick={handleExcelExport}
        />

        {/* Email Share */}
        <ExportButton
          icon={Mail}
          label="Share via Email"
          description="Send to stakeholders"
          status="idle"
          onClick={handleEmailShare}
        />
      </div>

      {/* Email Modal */}
      {emailModalOpen && (
        <EmailShareModal
          companyName={companyName}
          valueCaseId={valueCaseId}
          onClose={() => setEmailModalOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Export Button Component
 */
function ExportButton({
  icon: Icon,
  label,
  description,
  status,
  onClick
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  status: ExportStatus;
  onClick: () => void;
}) {
  const isLoading = status === 'loading';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all ${
        isSuccess
          ? 'border-green-300 bg-green-50'
          : isError
          ? 'border-red-300 bg-red-50'
          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {isLoading ? (
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
      ) : isSuccess ? (
        <CheckCircle2 className="h-8 w-8 text-green-600 mb-3" />
      ) : (
        <Icon className={`h-8 w-8 mb-3 ${isError ? 'text-red-600' : 'text-gray-600'}`} />
      )}
      
      <span className={`font-medium ${isError ? 'text-red-700' : 'text-gray-900'}`}>
        {isLoading ? 'Preparing...' : isSuccess ? 'Downloaded!' : isError ? 'Failed' : label}
      </span>
      
      <span className="text-xs text-gray-500 mt-1">{description}</span>
    </button>
  );
}

/**
 * Email Share Modal
 */
function EmailShareModal({
  companyName,
  valueCaseId,
  onClose
}: {
  companyName: string;
  valueCaseId: string;
  onClose: () => void;
}) {
  const [emails, setEmails] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    try {
      setSending(true);
      logger.info('Email share started', { valueCaseId, emails });

      // Validate emails
      const emailList = emails.split(',').map(e => e.trim()).filter(e => e);
      if (emailList.length === 0) {
        alert('Please enter at least one email address');
        setSending(false);
        return;
      }

      // Simulate sending
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In production:
      // await fetch('/api/customer/share/email', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ valueCaseId, emails: emailList, message })
      // });

      setSent(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      logger.error('Email share failed', error as Error);
      alert('Failed to send email. Please try again.');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {sent ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Email Sent!
            </h3>
            <p className="text-gray-600">
              Your report has been shared successfully.
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Share Report via Email
            </h3>

            <div className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Addresses
                </label>
                <input
                  type="text"
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="email@example.com, another@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={sending}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separate multiple emails with commas
                </p>
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a personal message..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={sending}
                />
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <p className="font-medium mb-1">Report Preview:</p>
                <p>{companyName} - Value Realization Report</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Download file helper
 */
function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
