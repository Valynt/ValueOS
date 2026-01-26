/**
 * Export Utilities
 */

export function exportToJSON(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function exportToCSV(data: any[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => row[h]).join(','));
  return [headers.join(','), ...rows].join('\n');
}
