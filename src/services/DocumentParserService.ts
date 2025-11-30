/**
 * Document Parser Service
 * 
 * Client-side service for parsing documents via edge function
 * and extracting insights via LLM.
 */

import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { LLMGateway } from '../lib/agent-fabric/LLMGateway';
import { llmConfig } from '../config/llm';

// ============================================================================
// Types
// ============================================================================

export interface ParsedDocument {
  text: string;
  metadata: {
    fileName?: string;
    fileType?: string;
    wordCount?: number;
    pageCount?: number;
  };
}

export interface ExtractedInsights {
  companyName?: string;
  industry?: string;
  painPoints: string[];
  stakeholders: Array<{
    name: string;
    role?: string;
    sentiment?: string;
  }>;
  opportunities: string[];
  nextSteps: string[];
  dealSize?: string;
  timeline?: string;
  competitors?: string[];
  summary: string;
}

// ============================================================================
// Document Parser Service
// ============================================================================

class DocumentParserService {
  private llm: LLMGateway;
  private functionUrl: string;

  constructor() {
    this.llm = new LLMGateway(llmConfig.provider, llmConfig.gatingEnabled);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    this.functionUrl = `${supabaseUrl}/functions/v1/parse-document`;
  }

  /**
   * Parse a document file and extract text
   */
  async parseDocument(file: File): Promise<ParsedDocument> {
    // For text files, parse locally
    if (this.isTextFile(file)) {
      const text = await file.text();
      return {
        text,
        metadata: {
          fileName: file.name,
          fileType: file.type || 'text/plain',
          wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
        },
      };
    }

    // For PDFs and DOCX, use edge function
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
        throw new Error(error.error || 'Failed to parse document');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Document parsing failed');
      }

      return {
        text: result.text,
        metadata: result.metadata,
      };
    } catch (error) {
      logger.error('Document parse error', error instanceof Error ? error : undefined);
      
      // Fallback: try basic text extraction
      return this.fallbackParse(file);
    }
  }

  /**
   * Extract insights from document text using LLM
   */
  async extractInsights(text: string, fileName?: string): Promise<ExtractedInsights> {
    const prompt = this.buildExtractionPrompt(text, fileName);

    try {
      const response = await this.llm.complete([
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ], {
        temperature: 0.3,
        max_tokens: 2048,
      });

      return this.parseInsightsResponse(response.content);
    } catch (error) {
      logger.error('LLM extraction error', error instanceof Error ? error : undefined);
      
      // Fallback to basic extraction
      return this.basicExtraction(text);
    }
  }

  /**
   * Parse and extract insights in one call
   */
  async parseAndExtract(file: File): Promise<{
    document: ParsedDocument;
    insights: ExtractedInsights;
  }> {
    const document = await this.parseDocument(file);
    const insights = await this.extractInsights(document.text, document.metadata.fileName);
    
    return { document, insights };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private isTextFile(file: File): boolean {
    return (
      file.type === 'text/plain' ||
      file.type === 'text/markdown' ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md')
    );
  }

  private async fallbackParse(file: File): Promise<ParsedDocument> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let text = decoder.decode(arrayBuffer);
      
      // Clean up
      text = text.replace(/\x00/g, '').trim();
      
      // Check if readable
      const readableRatio = (text.match(/[a-zA-Z]/g) || []).length / Math.max(text.length, 1);
      
      if (readableRatio < 0.2) {
        return {
          text: `[Unable to extract text from ${file.name}]\n\nPlease paste the content directly for best results.`,
          metadata: { fileName: file.name, fileType: file.type },
        };
      }

      return {
        text,
        metadata: {
          fileName: file.name,
          fileType: file.type,
          wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
        },
      };
    } catch {
      return {
        text: `[Failed to read ${file.name}]`,
        metadata: { fileName: file.name, fileType: file.type },
      };
    }
  }

  private buildExtractionPrompt(text: string, fileName?: string): string {
    // Truncate if too long (keep first 8000 chars)
    const truncatedText = text.length > 8000 
      ? text.slice(0, 8000) + '\n\n[Content truncated...]'
      : text;

    return `${fileName ? `Document: ${fileName}\n\n` : ''}${truncatedText}`;
  }

  private parseInsightsResponse(content: string): ExtractedInsights {
    try {
      // Try to parse as JSON first
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try direct JSON parse
      if (content.trim().startsWith('{')) {
        return JSON.parse(content);
      }

      // Fallback: extract structured data from text
      return this.parseTextResponse(content);
    } catch {
      return this.parseTextResponse(content);
    }
  }

  private parseTextResponse(content: string): ExtractedInsights {
    const insights: ExtractedInsights = {
      painPoints: [],
      stakeholders: [],
      opportunities: [],
      nextSteps: [],
      summary: '',
    };

    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();

      // Detect sections
      if (lower.includes('company') && lower.includes(':')) {
        insights.companyName = trimmed.split(':').slice(1).join(':').trim();
      } else if (lower.includes('industry') && lower.includes(':')) {
        insights.industry = trimmed.split(':').slice(1).join(':').trim();
      } else if (lower.includes('pain point') || lower.includes('challenge')) {
        currentSection = 'painPoints';
      } else if (lower.includes('stakeholder') || lower.includes('contact')) {
        currentSection = 'stakeholders';
      } else if (lower.includes('opportunit') || lower.includes('value')) {
        currentSection = 'opportunities';
      } else if (lower.includes('next step') || lower.includes('action')) {
        currentSection = 'nextSteps';
      } else if (lower.includes('summary')) {
        currentSection = 'summary';
      } else if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
        const item = trimmed.replace(/^[-•\d.]\s*/, '').trim();
        if (item && currentSection) {
          if (currentSection === 'stakeholders') {
            insights.stakeholders.push({ name: item });
          } else if (currentSection === 'summary') {
            insights.summary += item + ' ';
          } else if (currentSection in insights) {
            (insights[currentSection as keyof typeof insights] as string[]).push(item);
          }
        }
      } else if (currentSection === 'summary' && trimmed) {
        insights.summary += trimmed + ' ';
      }
    }

    insights.summary = insights.summary.trim();
    
    // If no summary was found, use first few sentences of content
    if (!insights.summary) {
      const sentences = content.split(/[.!?]+/).slice(0, 3);
      insights.summary = sentences.join('. ').trim();
    }

    return insights;
  }

  private basicExtraction(text: string): ExtractedInsights {
    const lines = text.split('\n').filter(l => l.trim());
    
    const painPoints: string[] = [];
    const stakeholders: Array<{ name: string; role?: string }> = [];
    const opportunities: string[] = [];
    const nextSteps: string[] = [];

    for (const line of lines) {
      const lower = line.toLowerCase();
      const trimmed = line.trim();
      
      if (lower.includes('pain') || lower.includes('challenge') || lower.includes('problem')) {
        painPoints.push(trimmed);
      }
      if (lower.match(/@|ceo|cfo|cto|cio|vp|director|manager|head of/i)) {
        stakeholders.push({ name: trimmed });
      }
      if (lower.includes('opportunity') || lower.includes('benefit') || lower.includes('value')) {
        opportunities.push(trimmed);
      }
      if (lower.includes('next') || lower.includes('action') || lower.includes('follow')) {
        nextSteps.push(trimmed);
      }
    }

    // Try to extract company name
    const companyMatch = text.match(/(?:company|client|account|customer)[:\s]+([A-Z][a-zA-Z\s&]+)/i);

    return {
      companyName: companyMatch?.[1]?.trim(),
      painPoints: painPoints.slice(0, 5),
      stakeholders: stakeholders.slice(0, 5),
      opportunities: opportunities.slice(0, 5),
      nextSteps: nextSteps.slice(0, 5),
      summary: lines.slice(0, 3).join(' ').slice(0, 200),
    };
  }
}

// ============================================================================
// System Prompt for Extraction
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at analyzing B2B sales and value engineering documents. Extract key information from the provided document.

Return your analysis as JSON in this exact format:
\`\`\`json
{
  "companyName": "Company name if mentioned",
  "industry": "Industry/sector if identifiable",
  "painPoints": ["List of challenges, problems, or pain points mentioned"],
  "stakeholders": [
    {"name": "Person name", "role": "Their role/title", "sentiment": "positive/neutral/negative"}
  ],
  "opportunities": ["List of value opportunities or benefits discussed"],
  "nextSteps": ["Action items or follow-ups mentioned"],
  "dealSize": "Deal value if mentioned",
  "timeline": "Timeline or urgency if mentioned",
  "competitors": ["Any competitors mentioned"],
  "summary": "2-3 sentence summary of the document"
}
\`\`\`

Guidelines:
- Extract actual content from the document, don't invent information
- If a field isn't present in the document, use null or empty array
- For stakeholders, try to identify their role and apparent sentiment
- Pain points should be specific challenges the prospect faces
- Opportunities should be potential value your solution could provide
- Keep the summary concise and actionable`;

// ============================================================================
// Singleton Export
// ============================================================================

export const documentParserService = new DocumentParserService();
