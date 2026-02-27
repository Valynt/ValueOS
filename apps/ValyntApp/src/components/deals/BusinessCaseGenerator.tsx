/**
 * BusinessCaseGenerator Component
 *
 * Generates a business case based on the Value Case and selected persona.
 * Uses AI to analyze and produce financial projections, benchmarks, and insights.
 */

import { useCallback, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { ValueCase } from '@/services/ValueCaseService';
import type { BuyerPersona } from './PersonaSelector';

export interface BusinessCaseResult {
  financial: {
    roi: number;
    npv: number;
    payback: number;
    totalValue: number;
    costSavings: number;
    revenueGain: number;
  };
  opportunity: {
    score: number;
    winProbability: number;
    riskLevel: 'low' | 'medium' | 'high';
    insights: Array<{
      type: 'strength' | 'weakness' | 'opportunity' | 'threat';
      title: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
    }>;
    recommendations: string[];
  };
  benchmarks: Array<{
    metric: string;
    customerValue: number;
    industryAverage: number;
    topQuartile: number;
    unit: string;
    higherIsBetter: boolean;
  }>;
  summary: string;
  generatedAt: Date;
}

export interface BusinessCaseGeneratorProps {
  /** The value case to generate business case for */
  valueCase: ValueCase;
  /** Selected buyer persona for tailoring */
  persona?: BuyerPersona;
  /** Callback when generation completes */
  onComplete: (result: BusinessCaseResult) => void;
  /** Callback when generation fails */
  onError: (error: string) => void;
}

type GenerationStep = 'idle' | 'analyzing' | 'calculating' | 'benchmarking' | 'generating' | 'complete' | 'error';

const STEP_LABELS: Record<GenerationStep, string> = {
  idle: 'Ready to generate',
  analyzing: 'Analyzing opportunity...',
  calculating: 'Calculating financials...',
  benchmarking: 'Comparing benchmarks...',
  generating: 'Generating insights...',
  complete: 'Complete',
  error: 'Error occurred',
};

const STEP_PROGRESS: Record<GenerationStep, number> = {
  idle: 0,
  analyzing: 25,
  calculating: 50,
  benchmarking: 75,
  generating: 90,
  complete: 100,
  error: 0,
};

// Mock business case generation
async function generateBusinessCase(
  valueCase: ValueCase,
  persona?: BuyerPersona
): Promise<BusinessCaseResult> {
  // Simulate API delay for each step
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Generate mock data based on value case
  const baseValue = Math.random() * 2_000_000 + 500_000;
  const roi = Math.round(150 + Math.random() * 200);
  const payback = Math.round(6 + Math.random() * 12);

  return {
    financial: {
      roi,
      npv: Math.round(baseValue * 0.8),
      payback,
      totalValue: Math.round(baseValue),
      costSavings: Math.round(baseValue * 0.4),
      revenueGain: Math.round(baseValue * 0.6),
    },
    opportunity: {
      score: Math.round(60 + Math.random() * 30),
      winProbability: Math.round(50 + Math.random() * 40),
      riskLevel: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
      insights: [
        {
          type: 'strength',
          title: 'Strong Executive Sponsorship',
          description: 'Clear alignment with C-suite priorities and budget authority.',
          impact: 'high',
        },
        {
          type: 'opportunity',
          title: 'Digital Transformation Initiative',
          description: 'Company is actively investing in modernization efforts.',
          impact: 'high',
        },
        {
          type: 'weakness',
          title: 'Limited Technical Resources',
          description: 'May require additional implementation support.',
          impact: 'medium',
        },
        {
          type: 'threat',
          title: 'Competitive Evaluation',
          description: 'Customer is evaluating 2-3 alternative solutions.',
          impact: 'medium',
        },
      ],
      recommendations: [
        'Schedule executive briefing to reinforce strategic alignment',
        'Propose phased implementation to address resource constraints',
        'Develop competitive differentiation deck highlighting unique value',
        'Create proof-of-concept to demonstrate quick wins',
      ],
    },
    benchmarks: [
      {
        metric: 'Time to Value',
        customerValue: 45,
        industryAverage: 90,
        topQuartile: 30,
        unit: 'days',
        higherIsBetter: false,
      },
      {
        metric: 'Process Efficiency',
        customerValue: 72,
        industryAverage: 65,
        topQuartile: 85,
        unit: '%',
        higherIsBetter: true,
      },
      {
        metric: 'Cost per Transaction',
        customerValue: 12.5,
        industryAverage: 18.0,
        topQuartile: 8.0,
        unit: '$',
        higherIsBetter: false,
      },
      {
        metric: 'Customer Satisfaction',
        customerValue: 78,
        industryAverage: 72,
        topQuartile: 88,
        unit: '%',
        higherIsBetter: true,
      },
    ],
    summary: `Based on our analysis of ${valueCase.company}, we project a ${roi}% ROI over 3 years with a payback period of ${payback} months. The opportunity shows strong alignment with their strategic priorities and presents a compelling value proposition.`,
    generatedAt: new Date(),
  };
}

export function BusinessCaseGenerator({
  valueCase,
  persona,
  onComplete,
  onError,
}: BusinessCaseGeneratorProps) {
  const [step, setStep] = useState<GenerationStep>('idle');
  const [result, setResult] = useState<BusinessCaseResult | null>(null);

  const generate = useCallback(async () => {
    try {
      setStep('analyzing');
      await new Promise((resolve) => setTimeout(resolve, 600));

      setStep('calculating');
      await new Promise((resolve) => setTimeout(resolve, 600));

      setStep('benchmarking');
      await new Promise((resolve) => setTimeout(resolve, 600));

      setStep('generating');
      const businessCase = await generateBusinessCase(valueCase, persona);

      setResult(businessCase);
      setStep('complete');
      onComplete(businessCase);
    } catch (error) {
      setStep('error');
      onError(error instanceof Error ? error.message : 'Failed to generate business case');
    }
  }, [valueCase, persona, onComplete, onError]);

  const reset = useCallback(() => {
    setStep('idle');
    setResult(null);
  }, []);

  // Idle state - show generate button
  if (step === 'idle') {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Generate Business Case</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Our AI will analyze the opportunity and generate a comprehensive business case
            with financial projections, benchmarks, and recommendations.
          </p>
          <Button onClick={generate} size="lg">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Business Case
          </Button>
        </div>
      </Card>
    );
  }

  // Generating state - show progress
  if (step !== 'complete' && step !== 'error') {
    return (
      <Card className="p-6">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{STEP_LABELS[step]}</h3>
          <Progress value={STEP_PROGRESS[step]} className="max-w-xs mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            This may take a few moments...
          </p>
        </div>
      </Card>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Generation Failed</h3>
          <p className="text-muted-foreground mb-6">
            We encountered an error while generating the business case.
          </p>
          <Button onClick={reset} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  // Complete state - show summary
  if (result) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">Business Case Generated</h3>
          </div>
          <Button onClick={reset} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Regenerate
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">ROI</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{result.financial.roi}%</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-700">Total Value</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">
              ${(result.financial.totalValue / 1_000_000).toFixed(1)}M
            </p>
          </div>
          <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-700">Payback</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{result.financial.payback} mo</p>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-lg bg-muted/50 border">
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Generated {result.generatedAt.toLocaleString()}
        </p>
      </Card>
    );
  }

  return null;
}
