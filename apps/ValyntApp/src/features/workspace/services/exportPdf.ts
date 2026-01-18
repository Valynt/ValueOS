/**
 * PDF Export Service
 * 
 * Generates professional PDF proposals from artifacts.
 * Uses browser print API for simplicity and quality.
 */

import type { Artifact } from '../agent/types';
import type { KPIData } from '../components/KPICards';

export interface ExportOptions {
  title: string;
  companyName: string;
  artifacts: Artifact[];
  kpiData?: KPIData;
  includeTimestamp?: boolean;
  confidential?: boolean;
}

/**
 * Generate a printable HTML document and trigger print dialog
 */
export function exportToPdf(options: ExportOptions): void {
  const {
    title,
    companyName,
    artifacts,
    kpiData,
    includeTimestamp = true,
    confidential = true,
  } = options;

  const timestamp = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Create print window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF');
    return;
  }

  // Generate HTML content
  const html = generatePrintHtml({
    title,
    companyName,
    artifacts,
    kpiData,
    timestamp: includeTimestamp ? timestamp : undefined,
    confidential,
  });

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

interface PrintHtmlOptions {
  title: string;
  companyName: string;
  artifacts: Artifact[];
  kpiData?: KPIData;
  timestamp?: string;
  confidential?: boolean;
}

function generatePrintHtml(options: PrintHtmlOptions): string {
  const { title, companyName, artifacts, kpiData, timestamp, confidential } = options;

  const kpiSection = kpiData ? generateKpiSection(kpiData) : '';
  const artifactSections = artifacts.map(generateArtifactSection).join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${companyName}</title>
  <style>
    @page {
      size: letter;
      margin: 1in;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: white;
    }
    
    .page {
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }
    
    /* Header */
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }
    
    .header-label {
      font-size: 10pt;
      font-weight: 600;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    
    .header-title {
      font-size: 28pt;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
      margin-bottom: 0.5rem;
    }
    
    .header-subtitle {
      font-size: 14pt;
      color: #64748b;
    }
    
    .header-meta {
      display: flex;
      gap: 2rem;
      margin-top: 1rem;
      font-size: 9pt;
      color: #64748b;
    }
    
    .header-meta span {
      display: flex;
      flex-direction: column;
    }
    
    .header-meta .label {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      font-size: 8pt;
    }
    
    /* KPI Cards */
    .kpi-section {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
      page-break-inside: avoid;
    }
    
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
    }
    
    .kpi-label {
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 0.25rem;
    }
    
    .kpi-value {
      font-size: 20pt;
      font-weight: 700;
      color: #0f172a;
    }
    
    .kpi-value.positive {
      color: #059669;
    }
    
    .kpi-value.negative {
      color: #dc2626;
    }
    
    .kpi-comparison {
      font-size: 9pt;
      color: #94a3b8;
      margin-top: 0.25rem;
    }
    
    /* Sections */
    .section {
      margin-bottom: 2rem;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 16pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e2e8f0;
    }
    
    /* Content */
    h1 { font-size: 20pt; font-weight: 700; margin: 1.5rem 0 1rem; color: #0f172a; }
    h2 { font-size: 16pt; font-weight: 600; margin: 1.25rem 0 0.75rem; color: #1e293b; }
    h3 { font-size: 13pt; font-weight: 600; margin: 1rem 0 0.5rem; color: #334155; }
    
    p { margin-bottom: 0.75rem; }
    
    ul, ol {
      margin: 0.75rem 0;
      padding-left: 1.5rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    strong {
      font-weight: 600;
      color: #0f172a;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 10pt;
    }
    
    th, td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    /* Value Drivers */
    .value-driver {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: #f8fafc;
      border-radius: 6px;
      margin-bottom: 0.5rem;
    }
    
    .value-driver-name {
      font-weight: 500;
    }
    
    .value-driver-impact {
      font-weight: 700;
      color: #059669;
    }
    
    /* Footer */
    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
      font-size: 9pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    
    .confidential {
      color: #dc2626;
      font-weight: 600;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="header-label">Value Proposal</div>
      <h1 class="header-title">${escapeHtml(title)}</h1>
      <p class="header-subtitle">Prepared for ${escapeHtml(companyName)}</p>
      <div class="header-meta">
        ${timestamp ? `<span><span class="label">Date</span>${timestamp}</span>` : ''}
        <span><span class="label">Version</span>1.0</span>
        ${confidential ? `<span><span class="label">Status</span><span class="confidential">Confidential</span></span>` : ''}
      </div>
    </header>
    
    ${kpiSection}
    
    ${artifactSections}
    
    <footer class="footer">
      <span>Generated by ValueOS</span>
      ${confidential ? '<span class="confidential">CONFIDENTIAL</span>' : ''}
    </footer>
  </div>
</body>
</html>
  `;
}

function generateKpiSection(kpi: KPIData): string {
  return `
    <div class="kpi-section">
      <div class="kpi-card">
        <div class="kpi-label">Net Present Value</div>
        <div class="kpi-value positive">${formatCurrency(kpi.npv)}</div>
        ${kpi.industryComparison?.npv ? `<div class="kpi-comparison">${kpi.industryComparison.npv}</div>` : ''}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Payback Period</div>
        <div class="kpi-value">${kpi.paybackMonths?.toFixed(1) || '—'} Mo</div>
        ${kpi.industryComparison?.payback ? `<div class="kpi-comparison">${kpi.industryComparison.payback}</div>` : ''}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cost of Inaction</div>
        <div class="kpi-value negative">${formatCostPerMonth(kpi.costOfInaction)}</div>
        ${kpi.industryComparison?.costOfInaction ? `<div class="kpi-comparison">${kpi.industryComparison.costOfInaction}</div>` : ''}
      </div>
    </div>
  `;
}

function generateArtifactSection(artifact: Artifact): string {
  const content = renderArtifactContent(artifact);
  
  return `
    <section class="section">
      <h2 class="section-title">${escapeHtml(artifact.title)}</h2>
      ${content}
    </section>
  `;
}

function renderArtifactContent(artifact: Artifact): string {
  const { content } = artifact;

  switch (content.kind) {
    case 'markdown':
      return renderMarkdown(content.markdown);
    
    case 'json':
      return renderJsonContent(content.data);
    
    case 'table':
      return renderTable(content.columns, content.rows);
    
    case 'chart':
      // Charts can't be easily printed, show as table
      return renderChartAsTable(content.data);
    
    default:
      return '<p>Content not available for print</p>';
  }
}

function renderMarkdown(markdown: string): string {
  // Simple markdown to HTML conversion
  return markdown
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\|(.+)\|/g, (match) => {
      // Simple table detection
      const cells = match.split('|').filter(c => c.trim());
      return `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join('')}</tr>`;
    })
    .replace(/^(?!<[hulo])/gm, '<p>')
    .replace(/(?<![>])$/gm, '</p>');
}

function renderJsonContent(data: Record<string, unknown>): string {
  // Check for value drivers
  if ('valueDrivers' in data && Array.isArray(data.valueDrivers)) {
    const drivers = data.valueDrivers as Array<{ name: string; impact: number; confidence?: number }>;
    const driversHtml = drivers.map(d => `
      <div class="value-driver">
        <span class="value-driver-name">${escapeHtml(d.name)}</span>
        <span class="value-driver-impact">${formatCurrency(d.impact)}</span>
      </div>
    `).join('');

    const total = data.totalValue as number | undefined;
    
    return `
      <div class="value-drivers">
        ${driversHtml}
        ${total ? `
          <div class="value-driver" style="background: #dcfce7; margin-top: 1rem;">
            <span class="value-driver-name"><strong>Total Value (${data.timeHorizon || '3 years'})</strong></span>
            <span class="value-driver-impact"><strong>${formatCurrency(total)}</strong></span>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Generic JSON display
  return `<pre style="background: #f8fafc; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 9pt;">${JSON.stringify(data, null, 2)}</pre>`;
}

function renderTable(columns: Array<{ key: string; label: string }>, rows: Record<string, unknown>[]): string {
  const headerHtml = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
  const rowsHtml = rows.map(row => {
    const cells = columns.map(c => `<td>${escapeHtml(String(row[c.key] ?? ''))}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function renderChartAsTable(data: Array<{ label: string; value: number }>): string {
  const rowsHtml = data.map(d => `
    <tr>
      <td>${escapeHtml(d.label)}</td>
      <td style="text-align: right; font-weight: 600;">${formatCurrency(d.value * 1_000_000)}</td>
    </tr>
  `).join('');

  return `
    <table>
      <thead><tr><th>Period</th><th style="text-align: right;">Value</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

// Helpers
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value?: number): string {
  if (value === undefined || value === null) return '—';
  
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatCostPerMonth(value?: number): string {
  if (value === undefined || value === null) return '—';
  
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k/mo`;
  }
  return `$${value.toFixed(0)}/mo`;
}

export default exportToPdf;
