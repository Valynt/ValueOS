import React, { useState } from "react";
import { X, FileBox, Check, ChevronRight } from "lucide-react";
import { Button } from "../Common/Button";
import { Card } from "../Common/Card";

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

const templates = [
  {
    id: "mro-reduction",
    title: "MRO Cost Reduction",
    industry: "Manufacturing",
    value: "$1.2M",
    description: "Optimize maintenance, repair, and operations inventory.",
    drivers: ["Inventory Optimization", "Vendor Consolidation"],
  },
  {
    id: "supply-chain",
    title: "Supply Chain Optimization",
    industry: "Manufacturing",
    value: "$850K",
    description: "Improve delivery times and reduce logistics overhead.",
    drivers: ["Route Optimization", "Carrier Negotiation"],
  },
  {
    id: "churn-reduction",
    title: "Customer Churn Reduction",
    industry: "SaaS",
    value: "$2.4M",
    description: "Identify at-risk accounts and automate retention.",
    drivers: ["Health Scoring", "Automated Outreach"],
  },
  {
    id: "cloud-spend",
    title: "Cloud Spend Optimization",
    industry: "Technology",
    value: "$450K",
    description: "Analyze AWS/Azure usage and identify waste.",
    drivers: ["Reserved Instances", "Idle Resource pruning"],
  },
];

export const TemplateSelectorModal: React.FC<TemplateSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [selectedIndustry, setSelectedIndustry] = useState<string>("All");

  if (!isOpen) return null;

  const filteredTemplates =
    selectedIndustry === "All"
      ? templates
      : templates.filter((t) => t.industry === selectedIndustry);

  const industries = [
    "All",
    ...Array.from(new Set(templates.map((t) => t.industry))),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <Card
        className="w-full max-w-4xl h-[80vh] flex flex-col bg-surface-2 border-border shadow-2xl animate-in fade-in zoom-in-95"
        noPadding
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Select a Template
            </h2>
            <p className="text-sm text-text-muted">
              Start with pre-configured drivers and KPIs
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar + Grid Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Filters */}
          <div className="w-64 border-r border-border p-4 space-y-2 bg-surface-1">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4 px-2">
              Industry
            </h3>
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setSelectedIndustry(ind)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex justify-between items-center ${
                  selectedIndustry === ind
                    ? "bg-teal-500/10 text-teal-500 font-medium"
                    : "text-text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {ind}
                {selectedIndustry === ind && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>

          {/* Template Grid */}
          <div className="flex-1 p-6 overflow-y-auto bg-surface-2/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => onSelect(template.id)}
                  className="group bg-card border border-border hover:border-teal-500/50 hover:shadow-glow rounded-lg p-5 cursor-pointer transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-surface-2 rounded-md group-hover:bg-teal-500/10 group-hover:text-teal-500 transition-colors">
                      <FileBox className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono text-success bg-success/10 px-2 py-1 rounded">
                      Est. {template.value}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-teal-500 transition-colors">
                    {template.title}
                  </h3>
                  <p className="text-sm text-text-muted mb-4 line-clamp-2">
                    {template.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {template.drivers.map((d) => (
                      <span
                        key={d}
                        className="text-xs bg-surface-1 border border-border px-2 py-1 rounded text-text-muted"
                      >
                        {d}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center text-teal-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                    Use Template <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
