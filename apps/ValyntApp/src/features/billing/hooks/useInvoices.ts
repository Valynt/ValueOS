import { useQuery } from "@tanstack/react-query";
import { InvoicesResponseSchema } from "@valueos/shared";
import type { BackendInvoice } from "@valueos/shared";

import { apiClient } from "@/api/client/unified-api-client";

import type { Invoice } from "../types";

// ---------------------------------------------------------------------------
// Shape translation
// ---------------------------------------------------------------------------

export function mapInvoiceStatus(status: string): Invoice["status"] {
  if (status === "paid") return "paid";
  if (status === "open" || status === "draft") return "pending";
  return "failed";
}

export function mapInvoice(raw: BackendInvoice): Invoice {
  return {
    // Use || not ?? so empty strings fall through to the next candidate.
    id: raw.invoice_number || raw.stripe_invoice_id || raw.id,
    amount: raw.amount_due,
    status: mapInvoiceStatus(raw.status),
    // Format as "Mon D, YYYY" to match the existing display style.
    date: new Date(raw.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    pdfUrl: raw.invoice_pdf ?? raw.hosted_invoice_url,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInvoices(limit = 10) {
  return useQuery<Invoice[]>({
    queryKey: ["billing", "invoices", limit],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(`/api/billing/invoices?limit=${limit}`);
      if (!res.success) {
        if (res.error?.code === "404" || res.error?.message?.includes("404")) return [];
        throw new Error(res.error?.message ?? "Failed to fetch invoices");
      }
      if (!res.data) return [];
      const parsed = InvoicesResponseSchema.parse(res.data);
      return parsed.invoices.map(mapInvoice);
    },
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("404")) return false;
      return failureCount < 2;
    },
  });
}
