/**
 * Email Analysis Service
 * 
 * Analyzes email threads for B2B sales context using LLM.
 * Extracts sentiment, stakeholders, key asks, and suggests next steps.
 */

import { logger } from '../lib/logger';
import { LLMGateway } from '../lib/agent-fabric/LLMGateway';
import { llmConfig } from '../config/llm';

// ============================================================================
// Types
// ============================================================================

export interface EmailParticipant {
  name: string;
  email?: string;
  role?: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  messageCount?: number;
}

export interface EmailThread {
  messages: ParsedEmail[];
  participants: EmailParticipant[];
}

export interface ParsedEmail {
  from: string;
  to?: string[];
  cc?: string[];
  date?: string;
  subject?: string;
  body: string;
}

export interface EmailAnalysis {
  threadSummary: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'ghosting_risk';
  sentimentExplanation: string;
  participants: EmailParticipant[];
  keyAsks: string[];
  objections: string[];
  commitments: string[];
  openQuestions: string[];
  suggestedNextStep: string;
  urgencyScore: number; // 1-10
  urgencyReason: string;
  dealSignals: {
    positive: string[];
    negative: string[];
  };
  lastContactDate?: string;
  daysSinceLastContact?: number;
}

// ============================================================================
// Email Analysis Service
// ============================================================================

class EmailAnalysisService {
  private llm: LLMGateway;

  constructor() {
    this.llm = new LLMGateway(llmConfig.provider, llmConfig.gatingEnabled);
  }

  /**
   * Analyze an email thread
   */
  async analyzeThread(rawEmailText: string): Promise<EmailAnalysis> {
    // First, parse the raw email text into structured messages
    const thread = this.parseEmailThread(rawEmailText);
    
    // Then analyze with LLM
    const analysis = await this.llmAnalyze(rawEmailText, thread);
    
    // Calculate days since last contact
    if (analysis.lastContactDate) {
      const lastDate = new Date(analysis.lastContactDate);
      const now = new Date();
      analysis.daysSinceLastContact = Math.floor(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
    
    return analysis;
  }

  /**
   * Parse raw email text into structured format
   */
  parseEmailThread(rawText: string): EmailThread {
    const messages: ParsedEmail[] = [];
    const participantMap = new Map<string, EmailParticipant>();

    // Split by common forward/reply patterns
    const parts = rawText.split(/(?=^(?:From:|On .+ wrote:|[-]{3,}.*Original Message))/mi);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.length < 20) continue;

      const email: ParsedEmail = {
        from: '',
        body: trimmed,
      };

      // Extract From
      const fromMatch = trimmed.match(/^From:\s*(.+?)(?:\n|$)/mi);
      if (fromMatch) {
        email.from = this.cleanEmailAddress(fromMatch[1]);
      }

      // Extract To
      const toMatch = trimmed.match(/^To:\s*(.+?)(?:\n|$)/mi);
      if (toMatch) {
        email.to = toMatch[1].split(/[,;]/).map(e => this.cleanEmailAddress(e));
      }

      // Extract Date
      const dateMatch = trimmed.match(/^(?:Date|Sent):\s*(.+?)(?:\n|$)/mi);
      if (dateMatch) {
        email.date = dateMatch[1].trim();
      }

      // Extract Subject
      const subjectMatch = trimmed.match(/^Subject:\s*(.+?)(?:\n|$)/mi);
      if (subjectMatch) {
        email.subject = subjectMatch[1].trim();
      }

      // Extract body (remove headers)
      const bodyStart = trimmed.search(/\n\n/);
      if (bodyStart > 0) {
        email.body = trimmed.slice(bodyStart).trim();
      }

      // Track participants
      if (email.from) {
        if (!participantMap.has(email.from)) {
          participantMap.set(email.from, {
            name: email.from,
            sentiment: 'unknown',
            messageCount: 0,
          });
        }
        const participant = participantMap.get(email.from)!;
        participant.messageCount = (participant.messageCount || 0) + 1;
      }

      messages.push(email);
    }

    // If no structured messages found, treat whole text as one message
    if (messages.length === 0) {
      messages.push({
        from: 'Unknown',
        body: rawText,
      });
    }

    return {
      messages,
      participants: Array.from(participantMap.values()),
    };
  }

  /**
   * Analyze email thread with LLM
   */
  private async llmAnalyze(rawText: string, thread: EmailThread): Promise<EmailAnalysis> {
    // Truncate if too long
    const truncatedText = rawText.length > 10000
      ? rawText.slice(0, 10000) + '\n\n[Thread truncated...]'
      : rawText;

    const prompt = `Analyze this email thread from a B2B sales perspective:

${truncatedText}

Provide your analysis as JSON.`;

    try {
      const response = await this.llm.complete([
        { role: 'system', content: EMAIL_ANALYSIS_PROMPT },
        { role: 'user', content: prompt },
      ], {
        temperature: 0.3,
        max_tokens: 2048,
      });

      return this.parseAnalysisResponse(response.content, thread);
    } catch (error) {
      logger.error('Email analysis failed', error instanceof Error ? error : undefined);
      return this.fallbackAnalysis(rawText, thread);
    }
  }

  /**
   * Parse LLM response into EmailAnalysis
   */
  private parseAnalysisResponse(content: string, thread: EmailThread): EmailAnalysis {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return this.validateAnalysis(parsed, thread);
      }

      // Try direct JSON parse
      if (content.trim().startsWith('{')) {
        const parsed = JSON.parse(content);
        return this.validateAnalysis(parsed, thread);
      }

      // Fallback to text parsing
      return this.parseTextAnalysis(content, thread);
    } catch {
      return this.parseTextAnalysis(content, thread);
    }
  }

  /**
   * Validate and fill in missing fields
   */
  private validateAnalysis(parsed: Partial<EmailAnalysis>, thread: EmailThread): EmailAnalysis {
    return {
      threadSummary: parsed.threadSummary || 'Email thread analysis',
      sentiment: this.validateSentiment(parsed.sentiment),
      sentimentExplanation: parsed.sentimentExplanation || '',
      participants: parsed.participants || thread.participants,
      keyAsks: parsed.keyAsks || [],
      objections: parsed.objections || [],
      commitments: parsed.commitments || [],
      openQuestions: parsed.openQuestions || [],
      suggestedNextStep: parsed.suggestedNextStep || 'Follow up with the prospect',
      urgencyScore: Math.min(10, Math.max(1, parsed.urgencyScore || 5)),
      urgencyReason: parsed.urgencyReason || '',
      dealSignals: parsed.dealSignals || { positive: [], negative: [] },
      lastContactDate: parsed.lastContactDate,
      daysSinceLastContact: parsed.daysSinceLastContact,
    };
  }

  /**
   * Validate sentiment value
   */
  private validateSentiment(sentiment?: string): EmailAnalysis['sentiment'] {
    const valid = ['positive', 'neutral', 'negative', 'ghosting_risk'];
    if (sentiment && valid.includes(sentiment)) {
      return sentiment as EmailAnalysis['sentiment'];
    }
    return 'neutral';
  }

  /**
   * Parse analysis from unstructured text
   */
  private parseTextAnalysis(content: string, thread: EmailThread): EmailAnalysis {
    const lines = content.split('\n');
    const analysis: EmailAnalysis = {
      threadSummary: '',
      sentiment: 'neutral',
      sentimentExplanation: '',
      participants: thread.participants,
      keyAsks: [],
      objections: [],
      commitments: [],
      openQuestions: [],
      suggestedNextStep: '',
      urgencyScore: 5,
      urgencyReason: '',
      dealSignals: { positive: [], negative: [] },
    };

    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();

      if (lower.includes('summary')) {
        currentSection = 'summary';
      } else if (lower.includes('sentiment')) {
        currentSection = 'sentiment';
        if (lower.includes('positive')) analysis.sentiment = 'positive';
        if (lower.includes('negative')) analysis.sentiment = 'negative';
        if (lower.includes('ghost')) analysis.sentiment = 'ghosting_risk';
      } else if (lower.includes('key ask') || lower.includes('request')) {
        currentSection = 'keyAsks';
      } else if (lower.includes('objection') || lower.includes('concern')) {
        currentSection = 'objections';
      } else if (lower.includes('next step') || lower.includes('recommend')) {
        currentSection = 'nextStep';
      } else if (lower.includes('urgency')) {
        currentSection = 'urgency';
        const urgencyMatch = trimmed.match(/(\d+)/);
        if (urgencyMatch) {
          analysis.urgencyScore = Math.min(10, Math.max(1, parseInt(urgencyMatch[1])));
        }
      } else if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
        const item = trimmed.replace(/^[-•\d.]\s*/, '').trim();
        if (item) {
          switch (currentSection) {
            case 'keyAsks':
              analysis.keyAsks.push(item);
              break;
            case 'objections':
              analysis.objections.push(item);
              break;
          }
        }
      } else if (trimmed && currentSection === 'summary') {
        analysis.threadSummary += trimmed + ' ';
      } else if (trimmed && currentSection === 'nextStep') {
        analysis.suggestedNextStep = trimmed;
      }
    }

    analysis.threadSummary = analysis.threadSummary.trim() || 
      lines.slice(0, 3).join(' ').slice(0, 200);

    return analysis;
  }

  /**
   * Fallback analysis when LLM fails
   */
  private fallbackAnalysis(rawText: string, thread: EmailThread): EmailAnalysis {
    const lower = rawText.toLowerCase();
    
    // Simple sentiment detection
    let sentiment: EmailAnalysis['sentiment'] = 'neutral';
    const positiveWords = ['thanks', 'great', 'excited', 'looking forward', 'appreciate'];
    const negativeWords = ['unfortunately', 'cannot', 'won\'t', 'delay', 'issue', 'problem'];
    const ghostingIndicators = ['no response', 'haven\'t heard', 'following up again'];

    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;
    const ghostingCount = ghostingIndicators.filter(w => lower.includes(w)).length;

    if (ghostingCount > 0) sentiment = 'ghosting_risk';
    else if (positiveCount > negativeCount + 1) sentiment = 'positive';
    else if (negativeCount > positiveCount + 1) sentiment = 'negative';

    return {
      threadSummary: rawText.slice(0, 200) + '...',
      sentiment,
      sentimentExplanation: 'Basic sentiment analysis based on keyword detection',
      participants: thread.participants,
      keyAsks: [],
      objections: [],
      commitments: [],
      openQuestions: [],
      suggestedNextStep: 'Review the thread and determine appropriate follow-up',
      urgencyScore: 5,
      urgencyReason: 'Unable to determine urgency',
      dealSignals: { positive: [], negative: [] },
    };
  }

  /**
   * Clean email address string
   */
  private cleanEmailAddress(raw: string): string {
    // Extract name from "Name <email@domain.com>" format
    const nameMatch = raw.match(/^([^<]+)/);
    const name = nameMatch ? nameMatch[1].trim() : raw.trim();
    
    // Remove quotes and extra whitespace
    return name.replace(/['"]/g, '').trim();
  }
}

// ============================================================================
// System Prompt
// ============================================================================

const EMAIL_ANALYSIS_PROMPT = `You are an expert B2B sales analyst. Analyze email threads to help sales reps understand prospect engagement and determine next steps.

Return your analysis as JSON in this exact format:
\`\`\`json
{
  "threadSummary": "2-3 sentence summary of the email thread",
  "sentiment": "positive|neutral|negative|ghosting_risk",
  "sentimentExplanation": "Why you assessed this sentiment",
  "participants": [
    {"name": "Person Name", "role": "Their role if apparent", "sentiment": "positive|neutral|negative|unknown"}
  ],
  "keyAsks": ["List of specific requests or requirements from the prospect"],
  "objections": ["Any concerns, objections, or pushback mentioned"],
  "commitments": ["Things either party committed to doing"],
  "openQuestions": ["Unresolved questions that need answers"],
  "suggestedNextStep": "The single best next action to take",
  "urgencyScore": 7,
  "urgencyReason": "Why this urgency level",
  "dealSignals": {
    "positive": ["Buying signals or positive indicators"],
    "negative": ["Warning signs or negative indicators"]
  },
  "lastContactDate": "Most recent email date if identifiable (ISO format)"
}
\`\`\`

Guidelines:
- "ghosting_risk" sentiment means prospect hasn't responded to multiple follow-ups
- Urgency 1-10: 1=no rush, 5=normal, 10=urgent/time-sensitive
- Look for buying signals: budget mentions, timeline, decision maker involvement
- Look for warning signs: delays, vague responses, going dark
- Identify the decision maker and their sentiment
- Be specific about next steps - not generic advice`;

// ============================================================================
// Singleton Export
// ============================================================================

export const emailAnalysisService = new EmailAnalysisService();
