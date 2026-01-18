/**
 * Slack Adapter
 * Bot integration for notifications and interactive messages
 */

import { EnterpriseAdapter } from "../base/EnterpriseAdapter";
import type {
  AdapterConfig,
  SyncOptions,
  SyncResult,
} from "../base/IEnterpriseAdapter";
import axios, { AxiosInstance } from "axios";

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: any[];
  thread_ts?: string;
}

export class SlackAdapter extends EnterpriseAdapter {
  readonly adapterType = "slack";
  readonly displayName = "Slack";

  private client: AxiosInstance;

  constructor(config: AdapterConfig) {
    super(config);

    this.client = axios.create({
      baseURL: "https://slack.com/api",
      headers: {
        Authorization: `Bearer ${config.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  async authenticate(): Promise<void> {
    const response = await this.client.post("/auth.test");
    this.authenticated = response.data.ok;
  }

  async refreshToken(): Promise<void> {
    // Slack bot tokens don't expire
  }

  protected async performSync(
    direction: string,
    options?: SyncOptions
  ): Promise<SyncResult> {
    // Slack is push-only (notifications)
    return {
      status: "success",
      pullCount: 0,
      pushCount: 0,
      conflicts: [],
      errors: [],
    };
  }

  /**
   * Post message to channel
   */
  async create(entityType: string, data: SlackMessage): Promise<any> {
    await this.rateLimiter.acquire();

    const response = await this.client.post("/chat.postMessage", data);

    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }

    return response.data;
  }

  /**
   * Get message
   */
  async read(entityType: string, id: string): Promise<any> {
    throw new Error("Read operation not supported for Slack");
  }

  /**
   * Update message
   */
  async update(entityType: string, id: string, data: any): Promise<any> {
    await this.rateLimiter.acquire();

    const response = await this.client.post("/chat.update", {
      ...data,
      ts: id,
    });

    return response.data;
  }

  /**
   * Delete message
   */
  async delete(entityType: string, id: string): Promise<void> {
    await this.rateLimiter.acquire();

    await this.client.post("/chat.delete", {
      channel: entityType, // Channel ID
      ts: id, // Message timestamp
    });
  }

  /**
   * Not applicable for Slack
   */
  async query(entityType: string, filters: any): Promise<any[]> {
    return [];
  }

  /**
   * Send approval request
   */
  async sendApprovalRequest(
    channel: string,
    title: string,
    details: string
  ): Promise<void> {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⚠️ Approval Required",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${title}*\n${details}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            value: "approve",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Reject" },
            style: "danger",
            value: "reject",
          },
        ],
      },
    ];

    await this.create("message", { channel, text: title, blocks });
  }

  /**
   * Send daily metrics summary
   */
  async sendDailySummary(channel: string, metrics: any): Promise<void> {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📊 Daily Value Summary",
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Total Value:*\n$${(metrics.totalValue / 1000000).toFixed(1)}M`,
          },
          { type: "mrkdwn", text: `*ROI:*\n${metrics.roi}%` },
          {
            type: "mrkdwn",
            text: `*Opportunities:*\n${metrics.opportunities}`,
          },
          { type: "mrkdwn", text: `*Win Rate:*\n${metrics.winRate}%` },
        ],
      },
    ];

    await this.create("message", { channel, text: "Daily Summary", blocks });
  }
}

export default SlackAdapter;
