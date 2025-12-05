import { logger } from '../../lib/logger';

export type OnboardingEventType =
  | 'user.created'
  | 'user.logged_in'
  | 'onboarding_completed'
  | 'feedback_submitted';

export interface OnboardingEvent {
  userId: string;
  email: string;
  organizationId: string;
  type: OnboardingEventType;
  timestamp?: number;
}

export type DripTemplate = 'day0_welcome' | 'day3_checklist_nudge' | 'day7_week1_survey';

interface DripSendResult {
  delivered: boolean;
  template: DripTemplate;
  userId: string;
  email: string;
  metadata?: Record<string, any>;
}

interface ProviderConfig {
  provider?: 'hubspot' | 'customerio';
  apiKey?: string;
  workspace?: string;
}

interface UserTimeline {
  createdAt: number;
  lastActiveAt: number;
  onboardingCompletedAt?: number;
}

/**
 * Lightweight orchestrator for the onboarding drip campaign.
 *
 * The service keeps an in-memory ledger of user activity so we can decide when to
 * trigger day-based emails. It is intentionally provider-agnostic so we can swap
 * between HubSpot and Customer.io without touching downstream code.
 */
export class DripCampaignService {
  private readonly sentTemplates = new Map<string, Set<DripTemplate>>();
  private readonly userTimelines = new Map<string, UserTimeline>();
  private readonly provider: ProviderConfig;

  constructor(provider: ProviderConfig = {}) {
    this.provider = provider;
  }

  /**
   * Accept real-time app events and run routing logic for the drip campaign.
   */
  async handleEvent(event: OnboardingEvent): Promise<DripSendResult[]> {
    const now = event.timestamp ?? Date.now();
    const timeline = this.userTimelines.get(event.userId) ?? {
      createdAt: now,
      lastActiveAt: now,
    };

    timeline.lastActiveAt = now;
    if (event.type === 'onboarding_completed') {
      timeline.onboardingCompletedAt = now;
    }

    this.userTimelines.set(event.userId, timeline);

    const actions: DripSendResult[] = [];
    if (event.type === 'user.created') {
      actions.push(await this.sendEmail('day0_welcome', event, now));
    }

    if (event.type === 'onboarding_completed') {
      actions.push(await this.sendEmail('day7_week1_survey', event, now));
    }

    actions.push(
      ...(await this.evaluateFollowUps({
        userId: event.userId,
        email: event.email,
        organizationId: event.organizationId,
        now,
      }))
    );

    return actions.filter(Boolean);
  }

  /**
   * Evaluate day-3 and day-7 logic. Run this on a cadence (cron/queue) to catch
   * users who have gone quiet after the welcome email.
   */
  async evaluateFollowUps(params: {
    userId: string;
    email: string;
    organizationId: string;
    now?: number;
  }): Promise<DripSendResult[]> {
    const now = params.now ?? Date.now();
    const timeline = this.userTimelines.get(params.userId);
    if (!timeline) return [];

    const daysSinceCreate = (now - timeline.createdAt) / (1000 * 60 * 60 * 24);
    const alreadySent = this.sentTemplates.get(params.userId) ?? new Set<DripTemplate>();

    const actions: DripSendResult[] = [];

    if (daysSinceCreate >= 3 && !timeline.onboardingCompletedAt && !alreadySent.has('day3_checklist_nudge')) {
      actions.push(
        await this.sendEmail(
          'day3_checklist_nudge',
          {
            userId: params.userId,
            email: params.email,
            organizationId: params.organizationId,
            type: 'user.logged_in',
            timestamp: now,
          },
          now,
          { reason: 'onboarding_missing_after_day3' }
        )
      );
    }

    if (daysSinceCreate >= 7 && !alreadySent.has('day7_week1_survey')) {
      actions.push(
        await this.sendEmail(
          'day7_week1_survey',
          {
            userId: params.userId,
            email: params.email,
            organizationId: params.organizationId,
            type: 'user.logged_in',
            timestamp: now,
          },
          now,
          { reason: 'scheduled_week1_survey' }
        )
      );
    }

    return actions.filter(Boolean);
  }

  private async sendEmail(
    template: DripTemplate,
    event: OnboardingEvent,
    timestamp: number,
    additionalMetadata: Record<string, any> = {}
  ): Promise<DripSendResult> {
    const sent = this.sentTemplates.get(event.userId) ?? new Set<DripTemplate>();
    if (sent.has(template)) {
      return {
        delivered: false,
        template,
        userId: event.userId,
        email: event.email,
        metadata: { skipped: 'already_sent', ...additionalMetadata },
      };
    }

    const templateData = {
      user_id: event.userId,
      email: event.email,
      organization_id: event.organizationId,
      waitlist_bypass: true,
      survey_link: this.buildSurveyLink(event.userId, event.email, template),
      timestamp,
      ...additionalMetadata,
    };

    const providerResult = await this.dispatchToProvider(template, templateData);
    if (providerResult) {
      sent.add(template);
      this.sentTemplates.set(event.userId, sent);
    }

    return {
      delivered: providerResult,
      template,
      userId: event.userId,
      email: event.email,
      metadata: templateData,
    };
  }

  private buildSurveyLink(userId: string, email: string, template: DripTemplate): string {
    const baseUrl = (process.env.VITE_APP_URL || process.env.APP_URL || 'https://app.valuecanvas.io').replace(/\/$/, '');
    const path = template === 'day7_week1_survey' ? '/surveys/week-one' : '/surveys/onboarding';
    const params = new URLSearchParams({
      user_id: userId,
      email,
      source: template,
    });

    return `${baseUrl}${path}?${params.toString()}`;
  }

  private async dispatchToProvider(template: DripTemplate, data: Record<string, any>): Promise<boolean> {
    if (!this.provider.apiKey) {
      logger.info('Skipping drip send (provider not configured)', { template, data });
      return false;
    }

    const payload = {
      template,
      workspace: this.provider.workspace ?? 'beta-onboarding',
      data,
    };

    logger.info(`Dispatching onboarding drip via ${this.provider.provider ?? 'customerio'}`, payload);

    // In a real integration we would call the provider's API. We log instead to keep
    // the script side-effect free in local/dev environments.
    return true;
  }
}

export const dripCampaignService = new DripCampaignService({
  provider: process.env.DRIP_PROVIDER as ProviderConfig['provider'],
  apiKey: process.env.DRIP_API_KEY,
  workspace: process.env.DRIP_WORKSPACE,
});
