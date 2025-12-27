import React, { useState } from "react";
import { Search, Globe, X, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "../Common/Input";
import { Button } from "../Common/Button";
import { Card } from "../Common/Card";

interface ResearchCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResearch: (domain: string) => void;
}

export const ResearchCompanyModal: React.FC<ResearchCompanyModalProps> = ({
  isOpen,
  onClose,
  onResearch,
}) => {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;

    setLoading(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    onResearch(domain);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card
        className="w-full max-w-lg bg-surface-2 border-border shadow-2xl animate-in fade-in zoom-in-95"
        noPadding
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 rounded-lg">
              <Search className="w-6 h-6 text-teal-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Research Company
              </h2>
              <p className="text-sm text-text-muted">
                Enter a domain to gather intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <Input
              label="Company Domain"
              placeholder="e.g. acmecorp.com"
              leftIcon={<Globe className="w-4 h-4" />}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              autoFocus
            />

            <div className="bg-surface-1 p-4 rounded-lg border border-border">
              <h4 className="text-sm font-medium text-foreground mb-2">
                What we'll gather:
              </h4>
              <ul className="text-sm text-text-muted space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  Recent news & press releases
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  Financial reports (10-K, 10-Q)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  Key executive profiles
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  Market positioning analysis
                </li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!domain || loading}
              loading={loading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Start Research
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
