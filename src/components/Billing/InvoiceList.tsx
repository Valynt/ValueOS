/**
 * Invoice List Component
 * Displays invoice history with download links
 */

import React from 'react';
import { Download, ExternalLink, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Invoice } from '../../types/billing';

interface InvoiceListProps {
  invoices: Invoice[];
  loading?: boolean;
  onDownload?: (invoiceId: string) => void;
  onView?: (invoiceId: string) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  loading = false,
  onDownload,
  onView,
}) => {
  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'open':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'void':
      case 'uncollectible':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: Invoice['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No invoices yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {invoices.map(invoice => (
        <div
          key={invoice.id}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            {/* Left: Invoice Info */}
            <div className="flex items-center space-x-4">
              {getStatusIcon(invoice.status)}
              
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">
                    {invoice.invoice_number || 'Draft'}
                  </span>
                  <span className={`
                    text-xs px-2 py-1 rounded
                    ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' : ''}
                    ${invoice.status === 'open' ? 'bg-yellow-100 text-yellow-800' : ''}
                    ${invoice.status === 'void' || invoice.status === 'uncollectible' ? 'bg-red-100 text-red-800' : ''}
                    ${invoice.status === 'draft' ? 'bg-gray-100 text-gray-800' : ''}
                  `}>
                    {getStatusText(invoice.status)}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 mt-1">
                  {invoice.period_start && invoice.period_end && (
                    <span>
                      {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                    </span>
                  )}
                  {invoice.created_at && !invoice.period_start && (
                    <span>Created {formatDate(invoice.created_at)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Amount and Actions */}
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-xl font-bold text-gray-900">
                  {formatAmount(invoice.amount_due, invoice.currency)}
                </div>
                {invoice.status === 'paid' && invoice.paid_at && (
                  <div className="text-xs text-gray-500">
                    Paid {formatDate(invoice.paid_at)}
                  </div>
                )}
                {invoice.status === 'open' && invoice.due_date && (
                  <div className="text-xs text-yellow-600">
                    Due {formatDate(invoice.due_date)}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                {invoice.hosted_invoice_url && onView && (
                  <button
                    onClick={() => onView(invoice.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View invoice"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                )}
                
                {invoice.invoice_pdf_url && onDownload && (
                  <button
                    onClick={() => onDownload(invoice.id)}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    title="Download PDF"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Line Items (expandable) */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
                View line items ({invoice.line_items.length})
              </summary>
              <div className="mt-2 space-y-1 pl-4">
                {invoice.line_items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-gray-600">
                    <span>{item.description}</span>
                    <span>{formatAmount(item.amount / 100, invoice.currency)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ))}
    </div>
  );
};

export default InvoiceList;
