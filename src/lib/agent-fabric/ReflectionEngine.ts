import { LLMGateway } from './LLMGateway';
import { QualityRubric } from './types';
import { parseLLMOutputStrict } from '../../utils/safeJsonParser';
import { featureFlags } from '../../config/featureFlags';
import { z } from 'zod';

export interface QualityAssessment {
  total_score: number;
  max_score: number;
  dimension_scores: {
    traceability: number;
    relevance: number;
    realism: number;
    clarity: number;
    actionability: number;
    polish: number;
  };
  feedback: string;
  needs_refinement: boolean;
  improvement_suggestions: string[];
}

export class ReflectionEngine {
  constructor(private llmGateway: LLMGateway) {}

  async evaluateQuality(
    valueCaseData: any,
    rubric: QualityRubric,
    threshold: number
  ): Promise<QualityAssessment> {
    const evaluationPrompt = this.buildEvaluationPrompt(valueCaseData, rubric);

    const response = await this.llmGateway.complete([
      {
        role: 'system',
        content: `You are a quality assessment agent evaluating business value cases.
Your job is to score the value case on 6 dimensions (each 0-3 points) and provide actionable feedback.
Return ONLY valid JSON with no additional text or formatting.`
      },
      {
        role: 'user',
        content: evaluationPrompt
      }
    ], {
      temperature: 0.3,
      max_tokens: 1500
    });

    let assessment: QualityAssessment;
    if (featureFlags.ENABLE_SAFE_JSON_PARSER) {
      // Use SafeJSON parser with schema
      const schema = z.object({
        total_score: z.number(),
        max_score: z.number(),
        dimension_scores: z.object({
          traceability: z.number(),
          relevance: z.number(),
          realism: z.number(),
          clarity: z.number(),
          actionability: z.number(),
          polish: z.number(),
        }),
        feedback: z.string(),
      });
      assessment = await parseLLMOutputStrict(response.content, schema);
    } else {
      // Legacy parsing
      try {
        assessment = JSON.parse(response.content);
      } catch (e) {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          assessment = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to parse quality assessment response');
        }
      }
    }

    assessment.needs_refinement = assessment.total_score < threshold;
    return assessment;
  }

  private buildEvaluationPrompt(valueCaseData: any, rubric: QualityRubric): string {
    return `Evaluate the following value case based on the quality rubric.

VALUE CASE DATA:
${JSON.stringify(valueCaseData, null, 2)}

QUALITY RUBRIC (each dimension 0-${rubric.traceability} points):

1. TRACEABILITY (${rubric.traceability} points max)
   - Are all assumptions clearly documented?
   - Is there a clear provenance chain for claims?
   - Can users trace back to the source of each number?

2. RELEVANCE (${rubric.relevance} points max)
   - Do KPIs align with the buyer persona and industry?
   - Are pain points accurately addressed?
   - Is the context appropriate for the company profile?

3. REALISM (${rubric.realism} points max)
   - Are targets industry-validated and achievable?
   - Do the financial projections use reasonable assumptions?
   - Are the timelines realistic?

4. CLARITY (${rubric.clarity} points max)
   - Are insights explained in non-technical language?
   - Is the narrative easy to follow?
   - Are complex concepts simplified appropriately?

5. ACTIONABILITY (${rubric.actionability} points max)
   - Are explicit next steps provided?
   - Can stakeholders act on the recommendations?
   - Is the path forward clear?

6. POLISH (${rubric.polish} points max)
   - Are deliverables production-ready?
   - Is formatting consistent and professional?
   - Are there any errors or rough edges?

Return your assessment in this exact JSON format:
{
  "total_score": <number>,
  "max_score": ${rubric.traceability + rubric.relevance + rubric.realism + rubric.clarity + rubric.actionability + rubric.polish},
  "dimension_scores": {
    "traceability": <0-${rubric.traceability}>,
    "relevance": <0-${rubric.relevance}>,
    "realism": <0-${rubric.realism}>,
    "clarity": <0-${rubric.clarity}>,
    "actionability": <0-${rubric.actionability}>,
    "polish": <0-${rubric.polish}>
  },
  "feedback": "<1-2 sentence summary of overall quality>",
  "improvement_suggestions": ["<specific suggestion 1>", "<specific suggestion 2>", "..."]
}`;
  }

  async generateRefinementInstructions(
    assessment: QualityAssessment,
    previousData: any
  ): Promise<string> {
    const response = await this.llmGateway.complete([
      {
        role: 'system',
        content: 'You are a refinement coordinator. Generate specific instructions for improving a value case based on quality assessment feedback.'
      },
      {
        role: 'user',
        content: `Previous value case data:
${JSON.stringify(previousData, null, 2)}

Quality Assessment:
- Total Score: ${assessment.total_score}/${assessment.max_score}
- Feedback: ${assessment.feedback}
- Suggestions: ${assessment.improvement_suggestions.join('; ')}

Generate specific, actionable refinement instructions focusing on the weakest dimensions: ${
  Object.entries(assessment.dimension_scores)
    .filter(([_, score]) => score < 2)
    .map(([dim]) => dim)
    .join(', ')
}`
      }
    ], {
      temperature: 0.5,
      max_tokens: 800
    });

    return response.content;
  }
}
