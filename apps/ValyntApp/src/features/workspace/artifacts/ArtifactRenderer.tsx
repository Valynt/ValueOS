/**
 * ArtifactRenderer
 *
 * Renders artifacts based on their type and content kind.
 * Supports markdown, JSON, tables, and charts.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type {
  Artifact,
  ArtifactContent,
  ChartContent,
  JsonContent,
  MarkdownContent,
  TableContent
} from '../agent/types';

import { cn } from '@/lib/utils';

interface ArtifactRendererProps {
  artifact: Artifact;
  className?: string;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
}

/**
 * Main artifact renderer - switches on content kind
 */
export function ArtifactRenderer({
  artifact,
  className,
  onApprove,
  onReject,
  onEdit,
}: ArtifactRendererProps) {
  const { content, title, status, type } = artifact;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <ArtifactTypeIcon type={type} />
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ArtifactStatusBadge status={status} />
            <span className="text-xs text-slate-400">
              {new Date(artifact.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {status === 'proposed' && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              >
                Edit
              </button>
            )}
            {onReject && (
              <button
                onClick={onReject}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              >
                Reject
              </button>
            )}
            {onApprove && (
              <button
                onClick={onApprove}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
              >
                Approve
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50">
        <ContentRenderer content={content} />
      </div>
    </div>
  );
}

/**
 * Content renderer - switches on content kind
 */
function ContentRenderer({ content }: { content: ArtifactContent }) {
  switch (content.kind) {
    case 'markdown':
      return <MarkdownRenderer content={content} />;
    case 'json':
      return <JsonRenderer content={content} />;
    case 'table':
      return <TableRenderer content={content} />;
    case 'chart':
      return <ChartRenderer content={content} />;
    default:
      return <div className="text-slate-500">Unknown content type</div>;
  }
}

/**
 * Markdown content renderer
 */
function MarkdownRenderer({ content }: { content: MarkdownContent }) {
  return (
    <div className="prose prose-slate max-w-none bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium text-slate-700 mt-4 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-slate-600 leading-relaxed mb-4">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-2 mb-4 text-slate-600">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-2 mb-4 text-slate-600">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-slate-600">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-slate-700 border-t border-slate-100">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-4 italic text-slate-600 my-4">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-sm font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block p-4 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-sm font-mono">
                {children}
              </code>
            );
          },
        }}
      >
        {content.markdown}
      </ReactMarkdown>
    </div>
  );
}

/**
 * JSON content renderer (structured data view)
 */
function JsonRenderer({ content }: { content: JsonContent }) {
  const { data } = content;

  // Render value drivers if present
  if ('valueDrivers' in data && Array.isArray(data.valueDrivers)) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Value Drivers</h3>
          <div className="space-y-3">
            {(data.valueDrivers as Array<{ name: string; impact: number; confidence: number }>).map((driver, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-medium text-slate-800">{driver.name}</div>
                  <div className="text-sm text-slate-500">
                    Confidence: {Math.round(driver.confidence * 100)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-emerald-600">
                    ${(driver.impact / 1000000).toFixed(2)}M
                  </div>
                  <div className="text-xs text-slate-400">Annual Impact</div>
                </div>
              </div>
            ))}
          </div>

          {'totalValue' in data && typeof data.totalValue === 'number' && (
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
              <span className="font-medium text-slate-700">Total Value ({String(data.timeHorizon)})</span>
              <span className="text-2xl font-bold text-slate-900">
                ${(data.totalValue / 1000000).toFixed(2)}M
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback: render as formatted JSON
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <pre className="text-sm text-slate-700 overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Table content renderer
 */
function TableRenderer({ content }: { content: TableContent }) {
  const { columns, rows } = content;

  const formatValue = (value: unknown, type: string, format?: string): string => {
    if (value === null || value === undefined) return '-';

    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value as number);
      case 'percent':
        return `${(value as number).toFixed(1)}%`;
      case 'number':
        return new Intl.NumberFormat('en-US').format(value as number);
      case 'date':
        return new Date(value as string).toLocaleDateString();
      default:
        return String(value);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-slate-700">
                    {formatValue(row[col.key], col.type, col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Chart content renderer (simple bar chart)
 */
function ChartRenderer({ content }: { content: ChartContent }) {
  const { data, chartType, config } = content;
  const maxValue = Math.max(...data.map(d => d.value));

  // Extract metrics if available
  const metrics = config?.metrics as { roi?: number; npv?: number; paybackMonths?: number; irr?: number } | undefined;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      {/* Simple bar chart */}
      <div className="h-64 flex items-end justify-center gap-8 mb-6">
        {data.map((point, index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <span className="text-sm font-medium text-slate-600">
              ${point.value}M
            </span>
            {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props -- legacy waiver: decorative chart bars carry interim ARIA value metadata until chart primitives are replaced; expires=2026-09-30; owner=@valueos-frontend */}
            <div
              className="w-16 bg-primary rounded-t-md transition-all duration-500"
              style={{ height: `calc(var(--chart-bar-max, 180px) * ${(point.value / maxValue)})` }}
              aria-valuenow={point.value}
              aria-valuemax={maxValue}
              role="presentation"
            />
            <span className="text-sm text-slate-500">{point.label}</span>
          </div>
        ))}
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-4 gap-4 pt-6 border-t border-slate-100">
          {metrics.roi !== undefined && (
            <div className="text-center p-3 rounded-lg bg-slate-50">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">ROI</div>
              <div className="text-xl font-bold text-emerald-600">{metrics.roi}%</div>
            </div>
          )}
          {metrics.npv !== undefined && (
            <div className="text-center p-3 rounded-lg bg-slate-50">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">NPV</div>
              <div className="text-xl font-bold text-slate-900">
                ${(metrics.npv / 1000000).toFixed(1)}M
              </div>
            </div>
          )}
          {metrics.paybackMonths !== undefined && (
            <div className="text-center p-3 rounded-lg bg-slate-50">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Payback</div>
              <div className="text-xl font-bold text-slate-900">{metrics.paybackMonths} mo</div>
            </div>
          )}
          {metrics.irr !== undefined && (
            <div className="text-center p-3 rounded-lg bg-slate-50">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">IRR</div>
              <div className="text-xl font-bold text-slate-900">{Math.round(metrics.irr * 100)}%</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Artifact type icon
 */
function ArtifactTypeIcon({ type }: { type: Artifact['type'] }) {
  const iconClass = "w-5 h-5";

  switch (type) {
    case 'value_model':
      return (
        <svg className={cn(iconClass, "text-emerald-600")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'financial_projection':
      return (
        <svg className={cn(iconClass, "text-blue-600")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case 'executive_summary':
      return (
        <svg className={cn(iconClass, "text-purple-600")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    default:
      return (
        <svg className={cn(iconClass, "text-slate-600")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
}

/**
 * Artifact status badge
 */
function ArtifactStatusBadge({ status }: { status: Artifact['status'] }) {
  const styles = {
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    proposed: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    superseded: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  return (
    <span className={cn(
      'px-2 py-0.5 text-xs font-medium rounded border uppercase',
      styles[status]
    )}>
      {status}
    </span>
  );
}

export { ArtifactRenderer };
