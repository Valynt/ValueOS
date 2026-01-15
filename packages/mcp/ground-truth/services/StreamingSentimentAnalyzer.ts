/**
 * Real-Time Sentiment Analysis for Live Financial Events
 *
 * Provides streaming sentiment analysis for live financial events such as:
 * - Earnings call transcripts (live processing)
 * - Press conferences and investor presentations
 * - Live SEC filing disclosures
 * - Real-time market commentary
 *
 * Optimized for low-latency streaming analysis with incremental processing.
 */

import {
  SentimentAnalysisService,
  SentimentResult,
} from "./SentimentAnalysisService";
import { getEventBus } from "./EventBus";
import { logger } from "../../lib/logger";
import { getCache } from "../core/Cache";

export interface StreamingTranscript {
  sessionId: string;
  speaker: string;
  text: string;
  timestamp: number;
  sequenceNumber: number;
  isPartial: boolean; // True if more text is expected for this segment
}

export interface StreamingSentimentUpdate {
  sessionId: string;
  timestamp: number;
  currentSentiment: SentimentResult;
  sentimentTrend: "improving" | "declining" | "stable";
  keyPhrases: string[];
  riskIndicators: string[];
  confidence: number;
}

export interface LiveAnalysisSession {
  sessionId: string;
  eventType:
    | "earnings_call"
    | "press_conference"
    | "sec_hearing"
    | "investor_meeting";
  companyName: string;
  startTime: number;
  lastUpdate: number;
  transcriptBuffer: StreamingTranscript[];
  currentSentiment: SentimentResult | null;
  sentimentHistory: StreamingSentimentUpdate[];
  active: boolean;
}

export class StreamingSentimentAnalyzer {
  private sentimentService: SentimentAnalysisService;
  private eventBus = getEventBus();
  private activeSessions: Map<string, LiveAnalysisSession> = new Map();
  private cache = getCache();

  constructor() {
    this.sentimentService = new SentimentAnalysisService();
    this.setupEventHandlers();
  }

  /**
   * Start a new live sentiment analysis session
   */
  async startSession(
    sessionId: string,
    eventType: LiveAnalysisSession["eventType"],
    companyName: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (this.activeSessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const session: LiveAnalysisSession = {
      sessionId,
      eventType,
      companyName,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      transcriptBuffer: [],
      currentSentiment: null,
      sentimentHistory: [],
      active: true,
    };

    this.activeSessions.set(sessionId, session);

    // Publish session start event
    await this.eventBus.publish({
      type: "sentiment.session_started",
      source: "streaming-analyzer",
      data: {
        sessionId,
        eventType,
        companyName,
        metadata,
      },
      metadata: {
        correlationId: sessionId,
      },
    });

    logger.info("Started live sentiment analysis session", {
      sessionId,
      eventType,
      companyName,
    });
  }

  /**
   * End a live sentiment analysis session
   */
  async endSession(sessionId: string): Promise<LiveAnalysisSession | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    session.active = false;
    session.lastUpdate = Date.now();

    // Generate final sentiment analysis
    if (session.transcriptBuffer.length > 0) {
      await this.performFinalAnalysis(session);
    }

    // Publish session end event
    await this.eventBus.publish({
      type: "sentiment.session_ended",
      source: "streaming-analyzer",
      data: {
        sessionId,
        duration: Date.now() - session.startTime,
        totalTranscripts: session.transcriptBuffer.length,
        finalSentiment: session.currentSentiment,
      },
      metadata: {
        correlationId: sessionId,
      },
    });

    // Cache session results
    await this.cache.set(`sentiment_session:${sessionId}`, session, "tier2");

    this.activeSessions.delete(sessionId);

    logger.info("Ended live sentiment analysis session", {
      sessionId,
      duration: Date.now() - session.startTime,
      transcriptsProcessed: session.transcriptBuffer.length,
    });

    return session;
  }

  /**
   * Process streaming transcript data
   */
  async processTranscript(transcript: StreamingTranscript): Promise<void> {
    const session = this.activeSessions.get(transcript.sessionId);
    if (!session || !session.active) {
      logger.warn("Transcript received for inactive session", {
        sessionId: transcript.sessionId,
        speaker: transcript.speaker,
      });
      return;
    }

    // Add to session buffer
    session.transcriptBuffer.push(transcript);
    session.lastUpdate = Date.now();

    // Perform incremental analysis
    await this.performIncrementalAnalysis(session);

    logger.debug("Processed streaming transcript", {
      sessionId: transcript.sessionId,
      speaker: transcript.speaker,
      textLength: transcript.text.length,
      sequenceNumber: transcript.sequenceNumber,
      isPartial: transcript.isPartial,
    });
  }

  /**
   * Perform incremental sentiment analysis
   */
  private async performIncrementalAnalysis(
    session: LiveAnalysisSession
  ): Promise<void> {
    try {
      // Combine recent transcripts for analysis
      const recentTranscripts = session.transcriptBuffer.slice(-10); // Last 10 segments
      const combinedText = recentTranscripts
        .map((t) => `${t.speaker}: ${t.text}`)
        .join("\n");

      if (combinedText.length < 100) {
        return; // Not enough content for meaningful analysis
      }

      // Perform sentiment analysis
      const sentimentResult = await this.sentimentService.analyzeDocument({
        documentType:
          session.eventType === "earnings_call"
            ? "earnings_call"
            : "press_release",
        content: combinedText,
        companyName: session.companyName,
        period: new Date(session.startTime).toISOString().split("T")[0],
      });

      // Update session sentiment
      const previousSentiment = session.currentSentiment;
      session.currentSentiment = sentimentResult;

      // Calculate sentiment trend
      const sentimentTrend = this.calculateSentimentTrend(
        previousSentiment,
        sentimentResult
      );

      // Extract key phrases and risk indicators from recent content
      const recentContent = recentTranscripts.map((t) => t.text).join(" ");
      const keyPhrases = this.extractKeyPhrases(recentContent);
      const riskIndicators = this.extractRiskIndicators(recentContent);

      // Create sentiment update
      const update: StreamingSentimentUpdate = {
        sessionId: session.sessionId,
        timestamp: Date.now(),
        currentSentiment: sentimentResult,
        sentimentTrend,
        keyPhrases,
        riskIndicators,
        confidence: sentimentResult.confidence,
      };

      session.sentimentHistory.push(update);

      // Publish real-time sentiment update
      await this.eventBus.publish({
        type: "sentiment.live_update",
        source: "streaming-analyzer",
        data: update,
        metadata: {
          correlationId: session.sessionId,
          priority: this.getUpdatePriority(sentimentResult, sentimentTrend),
        },
      });

      // Keep only recent history
      if (session.sentimentHistory.length > 100) {
        session.sentimentHistory = session.sentimentHistory.slice(-50);
      }

      logger.debug("Sentiment analysis updated", {
        sessionId: session.sessionId,
        sentimentScore: sentimentResult.sentiment_score,
        trend: sentimentTrend,
        confidence: sentimentResult.confidence,
      });
    } catch (error) {
      logger.error(
        "Incremental sentiment analysis failed",
        error instanceof Error ? error : undefined,
        {
          sessionId: session.sessionId,
        }
      );
    }
  }

  /**
   * Perform final comprehensive analysis when session ends
   */
  private async performFinalAnalysis(
    session: LiveAnalysisSession
  ): Promise<void> {
    try {
      // Combine all transcripts for final analysis
      const fullTranscript = session.transcriptBuffer
        .map((t) => `${t.speaker}: ${t.text}`)
        .join("\n");

      const finalSentiment = await this.sentimentService.analyzeDocument({
        documentType:
          session.eventType === "earnings_call"
            ? "earnings_call"
            : "press_release",
        content: fullTranscript,
        companyName: session.companyName,
        period: new Date(session.startTime).toISOString().split("T")[0],
      });

      session.currentSentiment = finalSentiment;

      // Publish final analysis
      await this.eventBus.publish({
        type: "sentiment.final_analysis",
        source: "streaming-analyzer",
        data: {
          sessionId: session.sessionId,
          finalSentiment,
          sessionSummary: {
            duration: Date.now() - session.startTime,
            totalTranscripts: session.transcriptBuffer.length,
            sentimentHistory: session.sentimentHistory.length,
          },
        },
        metadata: {
          correlationId: session.sessionId,
          priority: "high",
        },
      });

      logger.info("Final sentiment analysis completed", {
        sessionId: session.sessionId,
        finalSentiment: finalSentiment.sentiment_score,
        confidence: finalSentiment.confidence,
      });
    } catch (error) {
      logger.error(
        "Final sentiment analysis failed",
        error instanceof Error ? error : undefined,
        {
          sessionId: session.sessionId,
        }
      );
    }
  }

  /**
   * Calculate sentiment trend between updates
   */
  private calculateSentimentTrend(
    previous: SentimentResult | null,
    current: SentimentResult
  ): "improving" | "declining" | "stable" {
    if (!previous) return "stable";

    const prevScore = previous.sentiment_score;
    const currScore = current.sentiment_score;
    const diff = currScore - prevScore;

    if (Math.abs(diff) < 0.05) return "stable";
    return diff > 0 ? "improving" : "declining";
  }

  /**
   * Extract key phrases from text content
   */
  private extractKeyPhrases(text: string): string[] {
    // Simple keyword extraction (would use NLP in production)
    const keywords = [
      "revenue",
      "earnings",
      "profit",
      "growth",
      "margin",
      "guidance",
      "forecast",
      "outlook",
      "challenge",
      "opportunity",
      "risk",
      "uncertainty",
      "confident",
      "concerned",
    ];

    const foundPhrases: string[] = [];
    const lowerText = text.toLowerCase();

    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        foundPhrases.push(keyword);
      }
    }

    return foundPhrases.slice(0, 5); // Limit to top 5
  }

  /**
   * Extract risk indicators from text
   */
  private extractRiskIndicators(text: string): string[] {
    const riskKeywords = [
      "risk",
      "uncertainty",
      "concern",
      "challenge",
      "difficult",
      "decline",
      "decrease",
      "reduction",
      "lower",
      "weak",
      "slow",
      "delay",
      "issue",
      "problem",
    ];

    const foundRisks: string[] = [];
    const lowerText = text.toLowerCase();

    for (const keyword of riskKeywords) {
      if (lowerText.includes(keyword)) {
        foundRisks.push(keyword);
      }
    }

    return foundRisks.slice(0, 3); // Limit to top 3
  }

  /**
   * Get priority level for sentiment updates
   */
  private getUpdatePriority(
    sentiment: SentimentResult,
    trend: string
  ): "low" | "medium" | "high" {
    // High priority for significant sentiment changes
    if (sentiment.confidence > 0.8) {
      if (Math.abs(sentiment.sentiment_score) > 0.7) return "high";
      if (trend === "improving" || trend === "declining") return "medium";
    }
    return "low";
  }

  /**
   * Set up event handlers for the streaming analyzer
   */
  private setupEventHandlers(): void {
    // Handle session management events
    this.eventBus.registerHandler("sentiment.start_session", async (event) => {
      await this.startSession(
        event.data.sessionId,
        event.data.eventType,
        event.data.companyName,
        event.data.metadata
      );
    });

    // Handle transcript processing events
    this.eventBus.registerHandler(
      "sentiment.process_transcript",
      async (event) => {
        await this.processTranscript(event.data.transcript);
      }
    );

    // Handle session end events
    this.eventBus.registerHandler("sentiment.end_session", async (event) => {
      await this.endSession(event.data.sessionId);
    });
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): LiveAnalysisSession[] {
    return Array.from(this.activeSessions.values()).filter((s) => s.active);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): LiveAnalysisSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    activeSessions: number;
    totalSessionsProcessed: number;
    averageSessionDuration: number;
  } {
    const activeSessions = this.getActiveSessions();
    const sessions = Array.from(this.activeSessions.values());

    const completedSessions = sessions.filter((s) => !s.active);
    const averageDuration =
      completedSessions.length > 0
        ? completedSessions.reduce(
            (sum, s) => sum + (s.lastUpdate - s.startTime),
            0
          ) / completedSessions.length
        : 0;

    return {
      activeSessions: activeSessions.length,
      totalSessionsProcessed: completedSessions.length,
      averageSessionDuration: averageDuration,
    };
  }
}
