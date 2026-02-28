import { api } from "../api/client";

import type { Invoice, PlanTier, Subscription, UsageMetric } from "@/features/billing";

interface BillingServiceConfig {
  stripePublicKey?: string;
}

class BillingService {
  private config: BillingServiceConfig = {};

  configure(config: BillingServiceConfig) {
    this.config = config;
  }

  async getSubscription(): Promise<Subscription | null> {
    try {
      return await api.get<Subscription>("/billing/subscription");
    } catch {
      return null;
    }
  }

  async getUsage(): Promise<UsageMetric[]> {
    try {
      return await api.get<UsageMetric[]>("/billing/usage");
    } catch {
      return [];
    }
  }

  async getInvoices(): Promise<Invoice[]> {
    try {
      const response = await api.get<{ invoices: Invoice[] }>("/billing/invoices");
      return response.invoices || [];
    } catch {
      return [];
    }
  }

  async changePlan(planTier: PlanTier): Promise<Subscription> {
    return api.put<Subscription>("/billing/subscription", { planTier });
  }

  async cancelSubscription(): Promise<void> {
    await api.delete("/billing/subscription");
  }

  async reactivateSubscription(): Promise<Subscription> {
    return api.post<Subscription>("/billing/subscription/reactivate");
  }

  async createCheckoutSession(planTier: PlanTier): Promise<{ url: string }> {
    return api.post<{ url: string }>("/billing/checkout", { planTier });
  }

  async createPortalSession(): Promise<{ url: string }> {
    return api.post<{ url: string }>("/billing/portal");
  }

  async downloadInvoice(invoiceId: string): Promise<{ pdfUrl: string }> {
    return api.get<{ pdfUrl: string }>(`/billing/invoices/${invoiceId}/pdf`);
  }
}

export const billingService = new BillingService();
