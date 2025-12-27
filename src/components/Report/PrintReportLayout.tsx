import React from "react";
import { ValueCase } from "../../services/ValueCaseService";
import { cn } from "../../utils/utils";
import {
  ArrowRight,
  Award,
  Minus,
  PieChart,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface PrintReportLayoutProps {
  caseData: ValueCase;
  hypotheses: any[];
  metrics: any[];
  summary: string;
  isPreview?: boolean;
}

export const PrintReportLayout: React.FC<PrintReportLayoutProps> = ({
  caseData,
  hypotheses,
  metrics,
  summary,
  isPreview = false,
}) => {
  return (
    <div
      className={cn(
        "bg-white text-slate-900 mx-auto transition-all origin-top",
        isPreview
          ? "w-full max-w-4xl shadow-2xl min-h-[1100px] rounded-lg overflow-hidden my-8"
          : "print-only hidden print:block max-w-[210mm] print:shadow-none print:m-0"
      )}
    >
      {/* Visual Header */}
      <div className="bg-slate-900 text-white p-12 print:p-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-indigo-500/30 print:border-black print:text-black print:bg-transparent">
              Strategic Value Assessment
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 print:text-black">
              {caseData.company}
            </h1>
            <p className="text-slate-400 text-lg print:text-slate-600">
              Executive Briefing & ROI Analysis
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center print:bg-black">
                <span className="font-bold text-white">V</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 font-medium">Valynt ValueOS</p>
            <p className="text-xs text-slate-600">
              {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="p-12 space-y-12 print:p-8 print:space-y-8">
        {/* Executive Summary */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 rounded-lg print:bg-transparent print:p-0">
              <Target className="w-5 h-5 text-indigo-600 print:text-black" />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">
              Executive Summary
            </h2>
          </div>
          <div className="prose prose-lg text-slate-600 leading-relaxed border-l-4 border-indigo-500 pl-6 py-1 print:border-black">
            {summary}
          </div>
        </section>

        {/* Key Metrics Grid */}
        {metrics && metrics.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-50 rounded-lg print:bg-transparent print:p-0">
                <PieChart className="w-5 h-5 text-emerald-600 print:text-black" />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">
                Projected Impact
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-8 print:grid-cols-2 print:gap-4">
              {metrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="relative overflow-hidden bg-slate-50 rounded-xl p-6 border border-slate-100 shadow-sm break-inside-avoid print:bg-white print:border-slate-300"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 print:hidden">
                    {metric.trend === "up" ? (
                      <TrendingUp size={48} />
                    ) : (
                      <TrendingDown size={48} />
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {metric.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-extrabold text-slate-900 print:text-3xl">
                      {metric.value}
                    </p>
                    <span
                      className={cn(
                        "text-sm font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 print:border print:border-black print:bg-transparent print:text-black",
                        metric.trend === "up"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {metric.trend === "up" ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {metric.trend === "up" ? "Improvement" : "Reduction"}
                    </span>
                  </div>
                  {/* Simple Bar visual */}
                  <div className="mt-4 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden print:border print:border-slate-300 print:bg-white">
                    <div className="h-full bg-indigo-600 w-[75%] rounded-full print:bg-black" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Strategic Drivers */}
        {hypotheses && hypotheses.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-blue-50 rounded-lg print:bg-transparent print:p-0">
                <Award className="w-5 h-5 text-blue-600 print:text-black" />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">
                Value Hypotheses
              </h2>
            </div>

            <div className="space-y-4">
              {hypotheses.map((hypo, idx) => (
                <div
                  key={idx}
                  className="flex gap-6 p-6 bg-white border border-slate-200 rounded-xl shadow-sm break-inside-avoid print:shadow-none print:border-slate-300"
                >
                  <div className="flex-shrink-0">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-sm print:bg-black print:text-white">
                      {idx + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      {hypo.title}
                    </h3>
                    <p className="text-slate-600 mb-4">{hypo.description}</p>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 print:bg-black" />
                        <span className="text-slate-500 font-medium">
                          Confidence:
                        </span>
                        <span className="font-bold text-slate-900">
                          {Math.round(hypo.confidence * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 print:bg-black" />
                        <span className="text-slate-500 font-medium">
                          Impact:
                        </span>
                        <span className="font-bold text-slate-900">
                          {hypo.impact || "High"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-slate-200 p-8 bg-slate-50 text-center print:bg-white print:border-t-2 print:border-black">
        <p className="text-slate-400 text-sm font-medium print:text-black">
          Confidential & Proprietary - Generated by Valynt
        </p>
      </div>
    </div>
  );
};
