/**
 * Billing & Usage Analytics Manager
 * 
 * Manages billing and usage tracking settings including:
 * - Token dashboard and real-time usage
 * - Value metering and milestone billing
 * - Subscription plans and tiers
 * - Invoicing and payment configuration
 */

import { ConfigurationManager } from '../ConfigurationManager';
import type {
  ConfigurationAccessLevel,
  ConfigurationScope,
  InvoicingConfig,
  SubscriptionPlanConfig,
  TokenDashboardConfig,
  ValueMeteringConfig
} from '../types/settings-matrix';

export class BillingUsageManager {
  private configManager: ConfigurationManager;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  // ========================================================================
  // Token Dashboard
  // ========================================================================

  async getTokenDashboard(
    scope: ConfigurationScope
  ): Promise<TokenDashboardConfig> {
    return this.configManager.getConfiguration<TokenDashboardConfig>(
      'token_dashboard',
      scope
    );
  }

  async updateTokenDashboard(
    scope: ConfigurationScope,
    config: Partial<TokenDashboardConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<TokenDashboardConfig> {
    const current = await this.getTokenDashboard(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'token_dashboard',
      updated,
      scope,
      accessLevel
    );
  }

  async enableRealTime(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<TokenDashboardConfig> {
    const current = await this.getTokenDashboard({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'token_dashboard',
      { ...current, enableRealTime: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setRefreshInterval(
    organizationId: string,
    intervalSeconds: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<TokenDashboardConfig> {
    const current = await this.getTokenDashboard({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'token_dashboard',
      { ...current, refreshIntervalSeconds: intervalSeconds },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableCostBreakdown(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<TokenDashboardConfig> {
    const current = await this.getTokenDashboard({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'token_dashboard',
      { ...current, showCostBreakdown: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setVisibleMetrics(
    organizationId: string,
    metrics: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<TokenDashboardConfig> {
    const current = await this.getTokenDashboard({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'token_dashboard',
      { ...current, visibleMetrics: metrics },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setAggregationPeriod(
    organizationId: string,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    accessLevel: ConfigurationAccessLevel
  ): Promise<TokenDashboardConfig> {
    const current = await this.getTokenDashboard({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'token_dashboard',
      { ...current, aggregationPeriod: period },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableExport(
    organizationId: string,
    enable: boolean,
    formats?: string[],
    accessLevel?: ConfigurationAccessLevel
  ): Promise<TokenDashboardConfig> {
    const current = await this.getTokenDashboard({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'token_dashboard',
      {
        ...current,
        enableExport: enable,
        exportFormats: formats
      },
      { type: 'tenant', tenantId: organizationId },
      accessLevel || 'tenant_admin'
    );
  }

  // ========================================================================
  // Value Metering
  // ========================================================================

  async getValueMetering(
    scope: ConfigurationScope
  ): Promise<ValueMeteringConfig> {
    return this.configManager.getConfiguration<ValueMeteringConfig>(
      'value_metering',
      scope
    );
  }

  async updateValueMetering(
    scope: ConfigurationScope,
    config: Partial<ValueMeteringConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ValueMeteringConfig> {
    const current = await this.getValueMetering(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'value_metering',
      updated,
      scope,
      accessLevel
    );
  }

  async enableValueMetering(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ValueMeteringConfig> {
    const current = await this.getValueMetering({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'value_metering',
      { ...current, enabled: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async addBillableMilestone(
    organizationId: string,
    milestone: {
      name: string;
      description?: string;
      price: number;
      trigger: string;
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<ValueMeteringConfig> {
    const current = await this.getValueMetering({
      type: 'tenant',
      tenantId: organizationId
    });

    const billableMilestones = [...(current.billableMilestones || []), milestone];

    return this.configManager.updateConfiguration(
      'value_metering',
      { ...current, billableMilestones },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async removeBillableMilestone(
    organizationId: string,
    milestoneIndex: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ValueMeteringConfig> {
    const current = await this.getValueMetering({
      type: 'tenant',
      tenantId: organizationId
    });

    const billableMilestones = (current.billableMilestones || []).filter(
      (_, i) => i !== milestoneIndex
    );

    return this.configManager.updateConfiguration(
      'value_metering',
      { ...current, billableMilestones },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setPricingModel(
    organizationId: string,
    model: 'per_user' | 'per_value' | 'hybrid' | 'usage_based',
    accessLevel: ConfigurationAccessLevel
  ): Promise<ValueMeteringConfig> {
    const current = await this.getValueMetering({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'value_metering',
      { ...current, pricingModel: model },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setCustomMetrics(
    organizationId: string,
    metrics: Array<{ name: string; unit: string; price: number }>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ValueMeteringConfig> {
    const current = await this.getValueMetering({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'value_metering',
      { ...current, customMetrics: metrics },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Subscription Plan
  // ========================================================================

  async getSubscriptionPlan(
    scope: ConfigurationScope
  ): Promise<SubscriptionPlanConfig> {
    return this.configManager.getConfiguration<SubscriptionPlanConfig>(
      'subscription_plan',
      scope
    );
  }

  async updateSubscriptionPlan(
    scope: ConfigurationScope,
    config: Partial<SubscriptionPlanConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SubscriptionPlanConfig> {
    const current = await this.getSubscriptionPlan(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'subscription_plan',
      updated,
      scope,
      accessLevel
    );
  }

  async setTier(
    organizationId: string,
    tier: 'free' | 'starter' | 'professional' | 'enterprise',
    accessLevel: ConfigurationAccessLevel
  ): Promise<SubscriptionPlanConfig> {
    const current = await this.getSubscriptionPlan({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'subscription_plan',
      { ...current, tier },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setBillingCycle(
    organizationId: string,
    cycle: 'monthly' | 'quarterly' | 'annual',
    accessLevel: ConfigurationAccessLevel
  ): Promise<SubscriptionPlanConfig> {
    const current = await this.getSubscriptionPlan({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'subscription_plan',
      { ...current, billingCycle: cycle },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableAutoRenew(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SubscriptionPlanConfig> {
    const current = await this.getSubscriptionPlan({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'subscription_plan',
      { ...current, autoRenew: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setTrialPeriod(
    organizationId: string,
    days: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SubscriptionPlanConfig> {
    const current = await this.getSubscriptionPlan({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'subscription_plan',
      { ...current, trialPeriodDays: days },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setAddons(
    organizationId: string,
    addons: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<SubscriptionPlanConfig> {
    const current = await this.getSubscriptionPlan({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'subscription_plan',
      { ...current, addons },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setCustomPricing(
    organizationId: string,
    pricing: { basePrice: number; perUserPrice?: number; customRates?: Record<string, number> },
    accessLevel: ConfigurationAccessLevel
  ): Promise<SubscriptionPlanConfig> {
    const current = await this.getSubscriptionPlan({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'subscription_plan',
      { ...current, customPricing: pricing },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Invoicing
  // ========================================================================

  async getInvoicing(
    scope: ConfigurationScope
  ): Promise<InvoicingConfig> {
    return this.configManager.getConfiguration<InvoicingConfig>(
      'invoicing',
      scope
    );
  }

  async updateInvoicing(
    scope: ConfigurationScope,
    config: Partial<InvoicingConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<InvoicingConfig> {
    const current = await this.getInvoicing(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'invoicing',
      updated,
      scope,
      accessLevel
    );
  }

  async setPaymentMethod(
    organizationId: string,
    method: 'credit_card' | 'bank_transfer' | 'invoice' | 'paypal',
    accessLevel: ConfigurationAccessLevel
  ): Promise<InvoicingConfig> {
    const current = await this.getInvoicing({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'invoicing',
      { ...current, paymentMethod: method },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setBillingEmail(
    organizationId: string,
    email: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<InvoicingConfig> {
    const current = await this.getInvoicing({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'invoicing',
      { ...current, billingEmail: email },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setBillingAddress(
    organizationId: string,
    address: {
      street: string;
      city: string;
      state?: string;
      postalCode: string;
      country: string;
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<InvoicingConfig> {
    const current = await this.getInvoicing({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'invoicing',
      { ...current, billingAddress: address },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setTaxId(
    organizationId: string,
    taxId: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<InvoicingConfig> {
    const current = await this.getInvoicing({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'invoicing',
      { ...current, taxId },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setPurchaseOrder(
    organizationId: string,
    poNumber: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<InvoicingConfig> {
    const current = await this.getInvoicing({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'invoicing',
      { ...current, purchaseOrderNumber: poNumber },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setInvoiceFrequency(
    organizationId: string,
    frequency: 'monthly' | 'quarterly' | 'annual',
    accessLevel: ConfigurationAccessLevel
  ): Promise<InvoicingConfig> {
    const current = await this.getInvoicing({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'invoicing',
      { ...current, invoiceFrequency: frequency },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setPaymentTerms(
    organizationId: string,
    terms: 'immediate' | 'net15' | 'net30' | 'net60',
    accessLevel: ConfigurationAccessLevel
  ): Promise<InvoicingConfig> {
    const current = await this.getInvoicing({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'invoicing',
      { ...current, paymentTerms: terms },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableAutoPayment(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<InvoicingConfig> {
    const current = await this.getInvoicing({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'invoicing',
      { ...current, autoPayment: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Bulk Operations
  // ========================================================================

  async getAllBillingSettings(
    organizationId: string
  ): Promise<{
    tokenDashboard: TokenDashboardConfig;
    valueMetering: ValueMeteringConfig;
    subscriptionPlan: SubscriptionPlanConfig;
    invoicing: InvoicingConfig;
  }> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    const [tokenDashboard, valueMetering, subscriptionPlan, invoicing] =
      await Promise.all([
        this.getTokenDashboard(scope),
        this.getValueMetering(scope),
        this.getSubscriptionPlan(scope),
        this.getInvoicing(scope)
      ]);

    return {
      tokenDashboard,
      valueMetering,
      subscriptionPlan,
      invoicing
    };
  }

  async clearCache(organizationId: string): Promise<void> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    await Promise.all([
      this.configManager.clearCache('token_dashboard', scope),
      this.configManager.clearCache('value_metering', scope),
      this.configManager.clearCache('subscription_plan', scope),
      this.configManager.clearCache('invoicing', scope)
    ]);
  }
}
