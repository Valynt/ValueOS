/**
 * Call Analysis Service
 * 
 * Transcribes sales calls using OpenAI Whisper and analyzes
 * the transcript using Together.ai LLM.
 */

import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { LLMGateway } from '../lib/agent-fabric/LLMGateway';

// ============================================================================
// Types
// ============================================================================

export interface TranscriptionResult {
  transcript: string;
  duration: number;
  language: string;
}

export interface CallParticipant {
  name: string;
  role: 'sales_rep' | 'prospect' | 'unknown';
  talkTimePercent?: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface CallAnalysis {
  summary: string;
  duration: number;
  participants: CallParticipant[];
  painPoints: string[];
  objections: Array<{
    objection: string;
    response?: string;
    handled: boolean;
  }>;
  competitorsMentioned: string[];
  pricingDiscussed: boolean;
  pricingDetails?: string;
  budgetMentioned: boolean;
  budgetDetails?: string;
  timelineMentioned: boolean;
  timelineDetails?: string;
  decisionProcess?: string;
  nextSteps: string[];
  buyingSignals: string[];
  warningFlags: string[];
  callScore: number; // 1-10
  scoreBreakdown: {
    discovery: number;
    valueArticulation: number;
    objectionHandling: number;
    nextStepsClarity: number;
  };
  keyQuotes: Array<{
    speaker: string;
    quote: string;
    significance: string;
  }>;
  coachingTips: string[];
}

// ============================================================================
// Call Analysis Service
// ============================================================================

class CallAnalysisService {
  private llm: LLMGateway;
  private functionUrl: string;

  constructor() {
    this.llm = new LLMGateway('together', true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    this.functionUrl = `${supabaseUrl}/functions/v1/transcribe-audio`;
  }

  /**
   * Transcribe an audio file using OpenAI Whisper
   */
  async transcribe(file: File): Promise<TranscriptionResult> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: session ? {
          'Authorization': `Bearer ${session.access_token}`,
        } : {},
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Transcription failed');
      }

      return {
        transcript: result.transcript,
        duration: result.duration || 0,
        language: result.language || 'en',
      };
    } catch (error) {
      logger.error('Transcription failed', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Analyze a sales call transcript using LLM
   */
  async analyzeTranscript(transcript: string, duration: number): Promise<CallAnalysis> {
    // Truncate if too long (keep ~12000 chars for context window)
    const truncatedTranscript = transcript.length > 12000
      ? transcript.slice(0, 12000) + '\n\n[Transcript truncated...]'
      : transcript;

    const prompt = `Analyze this sales call transcript:

Duration: ${Math.round(duration / 60)} minutes

TRANSCRIPT:
${truncatedTranscript}

Provide comprehensive analysis as JSON.`;

    try {
      const response = await this.llm.complete([
        { role: 'system', content: CALL_ANALYSIS_PROMPT },
        { role: 'user', content: prompt },
      ], {
        temperature: 0.3,
        max_tokens: 3000,
      });

      return this.parseAnalysisResponse(response.content, duration);
    } catch (error) {
      logger.error('Call analysis failed', error instanceof Error ? error : undefined);
      return this.fallbackAnalysis(transcript, duration);
    }
  }

  /**
   * Transcribe and analyze in one call
   */
  async transcribeAndAnalyze(file: File): Promise<{
    transcription: TranscriptionResult;
    analysis: CallAnalysis;
  }> {
    // Step 1: Transcribe
    const transcription = await this.transcribe(file);
    
    // Step 2: Analyze
    const analysis = await this.analyzeTranscript(
      transcription.transcript,
      transcription.duration
    );

    return { transcription, analysis };
  }

  /**
   * Parse LLM response into CallAnalysis
   */
  private parseAnalysisResponse(content: string, duration: number): CallAnalysis {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return this.validateAnalysis(parsed, duration);
      }

      // Try direct JSON parse
      if (content.trim().startsWith('{')) {
        const parsed = JSON.parse(content);
        return this.validateAnalysis(parsed, duration);
      }

      // Fallback
      return this.fallbackAnalysis('', duration);
    } catch {
      return this.fallbackAnalysis('', duration);
    }
  }

  /**
   * Validate and fill in missing fields
   */
  private validateAnalysis(parsed: Partial<CallAnalysis>, duration: number): CallAnalysis {
    return {
      summary: parsed.summary || 'Sales call analysis',
      duration,
      participants: parsed.participants || [],
      painPoints: parsed.painPoints || [],
      objections: parsed.objections || [],
      competitorsMentioned: parsed.competitorsMentioned || [],
      pricingDiscussed: parsed.pricingDiscussed ?? false,
      pricingDetails: parsed.pricingDetails,
      budgetMentioned: parsed.budgetMentioned ?? false,
      budgetDetails: parsed.budgetDetails,
      timelineMentioned: parsed.timelineMentioned ?? false,
      timelineDetails: parsed.timelineDetails,
      decisionProcess: parsed.decisionProcess,
      nextSteps: parsed.nextSteps || [],
      buyingSignals: parsed.buyingSignals || [],
      warningFlags: parsed.warningFlags || [],
      callScore: Math.min(10, Math.max(1, parsed.callScore || 5)),
      scoreBreakdown: parsed.scoreBreakdown || {
        discovery: 5,
        valueArticulation: 5,
        objectionHandling: 5,
        nextStepsClarity: 5,
      },
      keyQuotes: parsed.keyQuotes || [],
      coachingTips: parsed.coachingTips || [],
    };
  }

  /**
   * Fallback analysis when LLM fails
   */
  private fallbackAnalysis(transcript: string, duration: number): CallAnalysis {
    return {
      summary: 'Call analysis could not be completed. Please review the transcript manually.',
      duration,
      participants: [],
      painPoints: [],
      objections: [],
      competitorsMentioned: [],
      pricingDiscussed: transcript.toLowerCase().includes('price') || transcript.toLowerCase().includes('cost'),
      budgetMentioned: transcript.toLowerCase().includes('budget'),
      timelineMentioned: transcript.toLowerCase().includes('timeline') || transcript.toLowerCase().includes('when'),
      nextSteps: [],
      buyingSignals: [],
      warningFlags: [],
      callScore: 5,
      scoreBreakdown: {
        discovery: 5,
        valueArticulation: 5,
        objectionHandling: 5,
        nextStepsClarity: 5,
      },
      keyQuotes: [],
      coachingTips: ['Review the full transcript for detailed insights'],
    };
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// ============================================================================
// System Prompt
// ============================================================================

const CALL_ANALYSIS_PROMPT = `You are an expert sales call analyst. Analyze sales call transcripts to help reps improve and extract deal intelligence.

Return your analysis as JSON in this exact format:
\`\`\`json
{
  "summary": "2-3 sentence summary of the call",
  "participants": [
    {"name": "Name if mentioned", "role": "sales_rep|prospect|unknown", "sentiment": "positive|neutral|negative"}
  ],
  "painPoints": ["Specific business challenges the prospect mentioned"],
  "objections": [
    {"objection": "What they said", "response": "How rep responded (if at all)", "handled": true/false}
  ],
  "competitorsMentioned": ["Names of any competitors discussed"],
  "pricingDiscussed": true/false,
  "pricingDetails": "What was discussed about pricing",
  "budgetMentioned": true/false,
  "budgetDetails": "Budget range or constraints mentioned",
  "timelineMentioned": true/false,
  "timelineDetails": "Timeline or urgency mentioned",
  "decisionProcess": "How decisions are made, who's involved",
  "nextSteps": ["Agreed upon next actions"],
  "buyingSignals": ["Positive indicators of intent to buy"],
  "warningFlags": ["Red flags or concerns"],
  "callScore": 7,
  "scoreBreakdown": {
    "discovery": 8,
    "valueArticulation": 7,
    "objectionHandling": 6,
    "nextStepsClarity": 7
  },
  "keyQuotes": [
    {"speaker": "Prospect", "quote": "Exact quote", "significance": "Why this matters"}
  ],
  "coachingTips": ["Specific suggestions to improve"]
}
\`\`\`

Scoring Guidelines (1-10):
- **Discovery**: Did rep ask good questions? Uncover real pain?
- **Value Articulation**: Did rep connect solution to prospect's needs?
- **Objection Handling**: Were concerns addressed effectively?
- **Next Steps Clarity**: Clear, committed next actions?

Be specific and actionable. Extract real quotes when possible.`;

// ============================================================================
// Singleton Export
// ============================================================================

export const callAnalysisService = new CallAnalysisService();
