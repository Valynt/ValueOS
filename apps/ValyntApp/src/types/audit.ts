export interface AuditFilter {
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: string;
  resource?: string;
}

export type ExportFormat = "csv" | "json" | "pdf";
