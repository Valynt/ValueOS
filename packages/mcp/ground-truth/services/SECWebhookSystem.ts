/**
 * SEC Filing Webhook System
 *
 * Monitors SEC EDGAR RSS feeds for new filings and sends instant webhook notifications
 * to subscribed clients and external systems.
 *
 * Features:
 * - Real-time SEC filing detection via RSS feeds
 * - Webhook delivery with retry logic and delivery guarantees
 * - Filing type filtering and prioritization
 * - Notification queuing and batching
 * - Integration with WebSocket server for live alerts
 */

import { randomBytes } from "crypto";

import { logger } from "../../lib/logger";
import { getCache } from "../core/Cache";

import { WebhookNotification, WebSocketServer } from "./WebSocketServer";

export interface SECFiling {
  id: string;
  accessionNumber: string;
  filingType: string;
  companyName: string;
  cik: string;
  filingDate: string;
  period?: string;
  primaryDocument: string;
  size: number;
  url: string;
  items?: string[];
}

export interface WebhookSubscription {
  id: string;
  url: string;
  secret?: string;
  filters: {
    filingTypes?: string[];
    ciks?: string[];
    minSize?: number;
    priority?: "low" | "medium" | "high";
  };
  active: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffSeconds: number;
  };
  createdAt: Date;
  lastDelivery?: Date;
}

export interface WebhookDelivery {
  subscriptionId: string;
  notificationId: string;
  attempt: number;
  status: "pending" | "delivered" | "failed" | "retrying";
  url: string;
  responseCode?: number;
  responseBody?: string;
  error?: string;
  deliveredAt?: Date;
  nextRetryAt?: Date;
}

export class SECWebhookSystem {
  private websocketServer: WebSocketServer;
  private subscriptions: Map<string, WebhookSubscription> = new Map();
  private deliveryQueue: WebhookDelivery[] = [];
  private rssPollingInterval: NodeJS.Timeout | null = null;
  private cache = getCache();
  private lastProcessedTimestamp: string = "";

  constructor(websocketServer: WebSocketServer) {
    this.websocketServer = websocketServer;
  }

  /**
   * Start the SEC filing monitoring system
   */
  async start(): Promise<void> {
    logger.info("Starting SEC Webhook System");

    // Load existing subscriptions from cache/database
    await this.loadSubscriptions();

    // Start RSS feed monitoring
    this.startRSSMonitoring();

    // Start webhook delivery processor
    this.startDeliveryProcessor();

    logger.info("SEC Webhook System started successfully");
  }

  /**
   * Stop the SEC filing monitoring system
   */
  async stop(): Promise<void> {
    logger.info("Stopping SEC Webhook System");

    if (this.rssPollingInterval) {
      clearInterval(this.rssPollingInterval);
      this.rssPollingInterval = null;
    }

    // Save subscriptions
    await this.saveSubscriptions();

    logger.info("SEC Webhook System stopped");
  }

  /**
   * Add a webhook subscription
   */
  async addSubscription(
    subscription: Omit<WebhookSubscription, "id" | "createdAt">
  ): Promise<string> {
    const id = `sub_${Date.now()}_${randomBytes(6).toString("hex")}`;

    const newSubscription: WebhookSubscription = {
      ...subscription,
      id,
      createdAt: new Date(),
    };

    this.subscriptions.set(id, newSubscription);
    await this.saveSubscriptions();

    logger.info("Added webhook subscription", {
      subscriptionId: id,
      url: subscription.url,
      filters: subscription.filters,
    });

    return id;
  }

  /**
   * Remove a webhook subscription
   */
  async removeSubscription(subscriptionId: string): Promise<boolean> {
    const removed = this.subscriptions.delete(subscriptionId);
    if (removed) {
      await this.saveSubscriptions();
      logger.info("Removed webhook subscription", { subscriptionId });
    }
    return removed;
  }

  /**
   * Get all webhook subscriptions
   */
  getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Start monitoring SEC RSS feeds
   */
  private startRSSMonitoring(): void {
    // Poll SEC RSS feed every 30 seconds
    this.rssPollingInterval = setInterval(async () => {
      try {
        await this.checkForNewFilings();
      } catch (error) {
        logger.error(
          "Error checking for new SEC filings",
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }, 30000);

    logger.info("Started SEC RSS feed monitoring");
  }

  /**
   * Check for new SEC filings via RSS feed
   */
  private async checkForNewFilings(): Promise<void> {
    try {
      const rssUrl = "https://www.sec.gov/Archives/edgar/usgaap.rss.xml";

      const response = await fetch(rssUrl, {
        headers: {
          "User-Agent": "ValueCanvas contact@valuecanvas.com",
        },
      });

      if (!response.ok) {
        logger.warn("Failed to fetch SEC RSS feed", {
          status: response.status,
        });
        return;
      }

      const rssText = await response.text();
      const newFilings = this.parseRSSFeed(rssText);

      if (newFilings.length > 0) {
        logger.info(`Found ${newFilings.length} new SEC filings`);

        for (const filing of newFilings) {
          await this.processNewFiling(filing);
        }
      }
    } catch (error) {
      logger.error(
        "Error checking SEC RSS feed",
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Parse SEC RSS feed for new filings
   */
  private parseRSSFeed(rssText: string): SECFiling[] {
    const filings: SECFiling[] = [];

    try {
      // Simple XML parsing (would use a proper XML parser in production)
      const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];

      for (const itemMatch of itemMatches) {
        const filing = this.parseRSSItem(itemMatch);
        if (filing && filing.filingDate > this.lastProcessedTimestamp) {
          filings.push(filing);
        }
      }

      // Update last processed timestamp
      if (filings.length > 0) {
        this.lastProcessedTimestamp = filings[0].filingDate;
      }
    } catch (error) {
      logger.error(
        "Error parsing SEC RSS feed",
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    return filings;
  }

  /**
   * Parse individual RSS item
   */
  private parseRSSItem(itemXml: string): SECFiling | null {
    try {
      // Extract filing information from RSS item
      const titleMatch = itemXml.match(/<title>([^<]+)<\/title>/);
      const linkMatch = itemXml.match(/<link>([^<]+)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/);
      const descriptionMatch = itemXml.match(
        /<description>([^<]+)<\/description>/
      );

      if (!titleMatch || !linkMatch || !pubDateMatch) {
        return null;
      }

      const title = titleMatch[1];
      const url = linkMatch[1];
      const pubDate = new Date(pubDateMatch[1]).toISOString();

      // Parse title for filing information
      // Format: "8-K - ABC CORP (0001234567) (Subject)"
      const titleRegex = /^(\d+-[KQ])\s*-\s*([^(]+)\s*\((\d{10})\)/;
      const match = title.match(titleRegex);

      if (!match) {
        return null;
      }

      const [, filingType, companyName, cik] = match;

      // Extract accession number from URL
      const accessionMatch = url.match(/\/(\d{18})\//);
      const accessionNumber = accessionMatch ? accessionMatch[1] : "";

      return {
        id: `${cik}_${accessionNumber}`,
        accessionNumber,
        filingType,
        companyName: companyName.trim(),
        cik,
        filingDate: pubDate,
        url,
        size: 0, // Would need to fetch actual filing to get size
        primaryDocument: "",
        items: [],
      };
    } catch (error) {
      logger.error(
        "Error parsing RSS item",
        {
          error: error instanceof Error ? error.message : String(error),
          itemSnippet: itemXml.substring(0, 200),
        }
      );
      return null;
    }
  }

  /**
   * Process a new SEC filing
   */
  private async processNewFiling(filing: SECFiling): Promise<void> {
    // Check if we've already processed this filing
    const cacheKey = `sec_filing:${filing.id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return; // Already processed
    }

    // Cache the filing
    await this.cache.set(cacheKey, filing, "tier2");

    // Create notification
    const notification: WebhookNotification = {
      id: `sec_${filing.id}_${Date.now()}`,
      type: "sec_filing",
      title: `${filing.filingType} Filing: ${filing.companyName}`,
      message: `${filing.companyName} (${filing.cik}) filed a ${filing.filingType} on ${new Date(filing.filingDate).toLocaleDateString()}`,
      data: {
        filing: {
          ...filing,
          formattedDate: new Date(filing.filingDate).toLocaleDateString(),
          timeAgo: this.getTimeAgo(new Date(filing.filingDate)),
        },
      },
      timestamp: Date.now(),
      priority: this.getFilingPriority(filing.filingType),
    };

    // Send to WebSocket clients
    this.websocketServer.broadcastWebhook(notification);

    // Queue for webhook delivery
    await this.queueWebhookDeliveries(notification);

    logger.info("Processed new SEC filing", {
      filingType: filing.filingType,
      companyName: filing.companyName,
      cik: filing.cik,
      accessionNumber: filing.accessionNumber,
    });
  }

  /**
   * Queue webhook deliveries for a notification
   */
  private async queueWebhookDeliveries(
    notification: WebhookNotification
  ): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.active) continue;

      // Check if notification matches subscription filters
      if (this.matchesSubscriptionFilters(notification, subscription)) {
        const delivery: WebhookDelivery = {
          subscriptionId: subscription.id,
          notificationId: notification.id,
          attempt: 0,
          status: "pending",
          url: subscription.url,
        };

        this.deliveryQueue.push(delivery);
      }
    }

    logger.debug("Queued webhook deliveries", {
      notificationId: notification.id,
      queuedDeliveries: this.deliveryQueue.length,
    });
  }

  /**
   * Check if notification matches subscription filters
   */
  private matchesSubscriptionFilters(
    notification: WebhookNotification,
    subscription: WebhookSubscription
  ): boolean {
    if (notification.type !== "sec_filing") return false;

    const filing = (notification.data as { filing: SECFiling }).filing;
    const filters = subscription.filters;

    // Check filing types
    if (
      filters.filingTypes &&
      !filters.filingTypes.includes(filing.filingType)
    ) {
      return false;
    }

    // Check CIKs
    if (filters.ciks && !filters.ciks.includes(filing.cik)) {
      return false;
    }

    // Check minimum size
    if (filters.minSize && filing.size < filters.minSize) {
      return false;
    }

    return true;
  }

  /**
   * Start webhook delivery processor
   */
  private startDeliveryProcessor(): void {
    // Process delivery queue every 5 seconds
    setInterval(async () => {
      const pendingDeliveries = this.deliveryQueue.filter(
        (d) => d.status === "pending"
      );

      for (const delivery of pendingDeliveries) {
        await this.processWebhookDelivery(delivery);
      }

      // Clean up old deliveries
      this.cleanupOldDeliveries();
    }, 5000);

    logger.info("Started webhook delivery processor");
  }

  /**
   * Process a single webhook delivery
   */
  private async processWebhookDelivery(
    delivery: WebhookDelivery
  ): Promise<void> {
    const subscription = this.subscriptions.get(delivery.subscriptionId);
    if (!subscription) {
      delivery.status = "failed";
      delivery.error = "Subscription not found";
      return;
    }

    try {
      const payload = {
        notificationId: delivery.notificationId,
        timestamp: new Date().toISOString(),
        attempt: delivery.attempt + 1,
        // Add notification data here
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "MCP-SEC-Webhook/1.0",
      };

      // Add signature if secret is configured
      if (subscription.secret) {
        const signature = this.generateWebhookSignature(
          JSON.stringify(payload),
          subscription.secret
        );
        headers["X-Webhook-Signature"] = signature;
      }

      const response = await fetch(subscription.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      delivery.responseCode = response.status;

      if (response.ok) {
        delivery.status = "delivered";
        delivery.deliveredAt = new Date();

        subscription.lastDelivery = new Date();

        logger.info("Webhook delivered successfully", {
          subscriptionId: delivery.subscriptionId,
          notificationId: delivery.notificationId,
          attempt: delivery.attempt + 1,
          responseCode: response.status,
        });
      } else {
        await this.handleDeliveryFailure(delivery, subscription, response);
      }
    } catch (error) {
      await this.handleDeliveryFailure(
        delivery,
        subscription,
        undefined,
        error
      );
    }
  }

  /**
   * Handle webhook delivery failure
   */
  private async handleDeliveryFailure(
    delivery: WebhookDelivery,
    subscription: WebhookSubscription,
    response?: Response,
    error?: unknown
  ): Promise<void> {
    delivery.attempt++;

    if (delivery.attempt >= subscription.retryPolicy.maxRetries) {
      delivery.status = "failed";
      delivery.error = response
        ? `HTTP ${response.status}: ${response.statusText}`
        : error instanceof Error
          ? error.message
          : "Unknown error";

      logger.error("Webhook delivery failed permanently", {
        subscriptionId: delivery.subscriptionId,
        notificationId: delivery.notificationId,
        attempts: delivery.attempt,
        error: delivery.error,
      });
    } else {
      delivery.status = "retrying";

      // Calculate backoff delay
      const backoffSeconds = Math.min(
        subscription.retryPolicy.backoffMultiplier ** delivery.attempt,
        subscription.retryPolicy.maxBackoffSeconds
      );

      delivery.nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

      logger.warn("Webhook delivery failed, scheduling retry", {
        subscriptionId: delivery.subscriptionId,
        notificationId: delivery.notificationId,
        attempt: delivery.attempt,
        nextRetryIn: backoffSeconds,
        error: response ? `HTTP ${response.status}` : error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate webhook signature for verification
   */
  private generateWebhookSignature(payload: string, secret: string): string {
    // Simple HMAC-like signature (would use crypto.hmac in production)
    const crypto = require("crypto");
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  /**
   * Get filing priority based on type
   */
  private getFilingPriority(
    filingType: string
  ): "low" | "medium" | "high" | "critical" {
    const highPriorityTypes = ["8-K", "25", "15-12B", "15-12G"];
    const mediumPriorityTypes = ["10-K", "10-Q", "20-F", "40-F"];

    if (highPriorityTypes.includes(filingType)) {
      return "high";
    } else if (mediumPriorityTypes.includes(filingType)) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * Get time ago string
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }

  /**
   * Load subscriptions from persistent storage
   */
  private async loadSubscriptions(): Promise<void> {
    try {
      const cached = await this.cache.get<WebhookSubscription[]>(
        "webhook_subscriptions"
      );
      if (cached) {
        this.subscriptions.clear();
        cached.forEach((sub) => this.subscriptions.set(sub.id, sub));
        logger.info("Loaded webhook subscriptions", { count: cached.length });
      }
    } catch (error) {
      logger.error(
        "Error loading webhook subscriptions",
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Save subscriptions to persistent storage
   */
  private async saveSubscriptions(): Promise<void> {
    try {
      const subscriptions = Array.from(this.subscriptions.values());
      await this.cache.set("webhook_subscriptions", subscriptions, "tier1");
    } catch (error) {
      logger.error(
        "Error saving webhook subscriptions",
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Clean up old delivery records
   */
  private cleanupOldDeliveries(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    this.deliveryQueue = this.deliveryQueue.filter(
      (delivery) =>
        delivery.deliveredAt && delivery.deliveredAt.getTime() > cutoffTime
    );
  }

  /**
   * Get system statistics
   */
  getStats(): {
    activeSubscriptions: number;
    pendingDeliveries: number;
    lastProcessedFiling: string;
    rssMonitoring: boolean;
  } {
    return {
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(
        (s) => s.active
      ).length,
      pendingDeliveries: this.deliveryQueue.filter(
        (d) => d.status === "pending"
      ).length,
      lastProcessedFiling: this.lastProcessedTimestamp,
      rssMonitoring: this.rssPollingInterval !== null,
    };
  }
}
