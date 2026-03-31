/**
 * Executive Dashboard
 * 
 * New design matching Figma exports with:
 * - Revenue lift hero ($14.8M)
 * - Conversion lift metrics
 * - Engagement score rings
 * - 12-month trajectory chart
 * - Brand logo integration
 * - Strategic recommendations
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

import { PrismCard } from '@/components/ui/PrismCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { ChartBar } from '@/components/ui/ChartBar';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { prismGridStagger, prismCardItem } from '@/lib/animations';
import { cn } from '@/lib/utils';

// Mock data for the dashboard
const trajectoryData = [
  { month: 'Month 1', baseline: 30, optimized: 42 },
  { month: 'Month 2', baseline: 32, optimized: 48 },
  { month: 'Month 3', baseline: 31, optimized: 55 },
  { month: 'Month 4', baseline: 35, optimized: 62 },
  { month: 'Month 5', baseline: 38, optimized: 70 },
  { month: 'Month 6', baseline: 40, optimized: 82 },
  { month: 'Month 7', baseline: 42, optimized: 95 },
];

export function ExecutiveDashboard() {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Section: Revenue Lift */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Revenue Card */}
        <motion.div 
          className="md:col-span-2 bg-md-surface-container-lowest p-8 rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[320px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <MaterialIcon icon="trending_up" className="text-[160px]" />
          </div>
          
          <div className="relative z-10">
            <span className="text-xs font-semibold text-md-on-tertiary-container uppercase tracking-widest bg-violet-50 px-3 py-1 rounded-full">
              Projected Impact FY25
            </span>
            <h2 className="mt-6 text-6xl font-bold text-md-primary leading-none tracking-tighter">
              $14.8M
            </h2>
            <p className="mt-2 text-xl font-semibold text-md-secondary">Projected Revenue Lift</p>
          </div>
          
          {/* Mini Chart */}
          <div className="relative z-10 pt-8 border-t border-md-outline-variant/30 mt-auto flex items-end gap-4">
            <div className="flex-1 h-32 flex items-end gap-2">
              {[40, 45, 52, 50, 70, 85, 100].map((height, i) => (
                <div 
                  key={i}
                  className={cn(
                    'w-full rounded-t-sm transition-all duration-300',
                    i < 4 ? 'bg-md-surface-container-high' : 'bg-md-tertiary-container'
                  )}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="w-1/3 text-sm text-md-on-surface-variant leading-relaxed">
              Aggregated growth model across 14 product categories leveraging AI-optimized strategies.
            </div>
          </div>
        </motion.div>
        
        {/* Side Cards */}
        <div className="space-y-6">
          {/* Conversion Lift */}
          <MetricCard
            label="Conversion Lift"
            value="+22%"
            trend={{ value: 22, label: 'Upper Bound' }}
            description="Projected increase in velocity via AI intelligence tuning."
            variant="highlight"
            className="h-[200px]"
          />
          
          {/* Brand Integration */}
          <PrismCard className="h-[104px] flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-md-primary opacity-40 mb-2">CLIENT</span>
            <p className="text-[11px] font-medium text-md-on-surface-variant uppercase tracking-widest">
              Tailored Proposal for Enterprise
            </p>
          </PrismCard>
        </div>
      </section>
      
      {/* Metrics & Asymmetric Content */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Engagement Scores */}
        <div className="lg:col-span-4 space-y-8">
          <h3 className="text-sm font-semibold text-md-on-surface-variant uppercase tracking-widest">
            Effectiveness Baseline
          </h3>
          
          {/* Current State */}
          <PrismCard className="relative">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-semibold">Current State</span>
              <span className="text-xs bg-md-surface-container-high px-2 py-0.5 rounded text-md-on-surface-variant">
                Pre-Vizit
              </span>
            </div>
            <div className="flex items-center gap-6">
              <ProgressRing 
                value={74} 
                size={96} 
                variant="muted"
                showValue
                label="Engagement Score"
              />
              <div>
                <div className="text-xs text-md-on-surface-variant font-medium">Engagement Score</div>
                <div className="text-sm text-md-secondary mt-1 italic">
                  "Standard performance across peer brands."
                </div>
              </div>
            </div>
          </PrismCard>
          
          {/* Optimized State */}
          <PrismCard active className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 bg-md-tertiary-container h-full" />
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-bold text-md-on-tertiary-container">Vizit Optimized</span>
              <span className="text-[10px] bg-md-tertiary-container px-2 py-0.5 rounded text-white font-bold animate-pulse">
                PREDICTED
              </span>
            </div>
            <div className="flex items-center gap-6">
              <ProgressRing 
                value={92} 
                size={96} 
                variant="tertiary"
                showValue
                label="Projected Engagement"
              />
              <div>
                <div className="text-xs text-md-on-tertiary-container font-bold">Projected Engagement</div>
                <div className="text-sm text-md-on-surface mt-1 font-medium">
                  Top 2% of assets globally.
                </div>
              </div>
            </div>
          </PrismCard>
        </div>
        
        {/* Growth Chart */}
        <div className="lg:col-span-8 bg-md-surface-container-low rounded-xl p-10 min-h-[480px] flex flex-col">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h3 className="text-xl font-semibold text-md-primary">12-Month Revenue Trajectory</h3>
              <p className="text-sm text-md-on-surface-variant mt-2">
                Comparison of organic growth vs. AI-enhanced conversion optimization.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-md-surface-container-high" />
                <span className="text-xs font-medium text-md-on-surface-variant">Baseline</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-md-tertiary-container" />
                <span className="text-xs font-medium text-md-on-surface-variant">Vizit Optimized</span>
              </div>
            </div>
          </div>
          
          {/* Chart */}
          <div className="flex-1 flex items-end justify-between gap-2 border-b-2 border-md-outline-variant pb-2 relative">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-full border-t border-md-outline-variant/30 h-0" />
              ))}
            </div>
            
            {/* Bars */}
            {trajectoryData.map((data, i) => (
              <div key={i} className="relative flex-1 group">
                <div className="flex flex-col gap-1">
                  <div 
                    className="w-full bg-md-surface-container-high rounded-t transition-all group-hover:bg-md-outline-variant"
                    style={{ height: `${data.baseline * 1.5}px` }}
                  />
                  <div 
                    className="w-full bg-md-tertiary-container rounded-t opacity-80"
                    style={{ height: `${data.optimized * 1.5}px` }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* X Axis Labels */}
          <div className="flex justify-between mt-4 text-[10px] font-bold text-md-on-surface-variant uppercase tracking-tighter">
            <span>Month 1</span>
            <span>Month 3</span>
            <span>Month 6</span>
            <span>Month 9</span>
            <span>Month 12</span>
          </div>
          
          {/* Insight */}
          <div className="mt-10 p-4 bg-white/40 rounded-lg flex items-start gap-4 border border-white/60">
            <MaterialIcon icon="lightbulb" className="text-md-on-tertiary-container flex-shrink-0" filled />
            <p className="text-xs text-md-on-surface-variant leading-relaxed">
              <strong className="text-md-primary">Insight:</strong> The widening gap represents the cumulative 
              impact of AI workflows. By Month 12, the optimized revenue outpaces baseline by{' '}
              <span className="text-md-on-tertiary-container font-bold">28.4%</span>.
            </p>
          </div>
        </div>
      </section>
      
      {/* Bottom Editorial Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-10 py-12">
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-md-on-surface-variant uppercase tracking-widest">
            Strategic Recommendations
          </h3>
          <div className="relative rounded-xl overflow-hidden aspect-video shadow-2xl bg-md-surface-container-high">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
              <div className="text-white">
                <p className="text-[10px] font-bold tracking-widest uppercase mb-1">Featured Case Study</p>
                <h4 className="text-lg font-bold">Revenue Optimization | Q4 Strategy</h4>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col justify-center space-y-8 pl-0 md:pl-10 border-l border-md-outline-variant">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-md-on-tertiary-container">Strategic Recommendation</p>
            <p className="text-xl font-semibold text-md-primary">Consolidate Value Intelligence</p>
            <p className="text-base text-md-on-surface-variant leading-relaxed">
              Integrate AI insights into your primary business intelligence system to automate 
              effectiveness scoring across all regional markets. Our model suggests this will save 
              4,200 analysis hours annually.
            </p>
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-3 bg-md-primary text-white rounded-xl font-bold text-sm hover:bg-md-on-primary-container transition-colors">
              Download Full Report
            </button>
            <button className="px-6 py-3 bg-md-surface-container-high text-md-primary rounded-xl font-bold text-sm hover:bg-md-surface-container-highest transition-colors">
              Schedule Deep Dive
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
