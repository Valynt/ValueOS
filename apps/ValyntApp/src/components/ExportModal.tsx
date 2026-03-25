// Only export the component for fast refresh compatibility
import { Download, FileText } from "lucide-react";
import React, { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

type ExportOption = "valueTree" | "financials" | "benchmarks" | "realization";

const defaultOptions: Record<ExportOption, boolean> = {
  valueTree: true,
  financials: true,
  benchmarks: true,
  realization: false,
};

const optionLabels: Record<ExportOption, string> = {
  valueTree: "Value Tree Visualization",
  financials: "Financial Projections (NPV/IRR)",
  benchmarks: "ESO Benchmarks & Provenance",
  realization: "Realization Variance Analysis",
};

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  title = "Export Business Case",
  description = "Select the components you want to include in your export.",
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<Record<ExportOption, boolean>>(defaultOptions);

  const handleOptionChange = useCallback((key: ExportOption, checked: boolean) => {
    setOptions(prev => ({ ...prev, [key]: checked }));
  }, []);

  const selectedCount = Object.values(options).filter(Boolean).length;
  const hasSelection = selectedCount > 0;

  const handleExport = useCallback(() => {
    if (!hasSelection) return;

    setIsExporting(true);
    // Simulate export process
    setTimeout(() => {
      setIsExporting(false);
      alert("Export complete! Your file is ready.");
      onClose();
    }, 1500);
  }, [hasSelection, onClose]);

  const handleClose = useCallback(() => {
    if (!isExporting) {
      setOptions(defaultOptions);
      onClose();
    }
  }, [isExporting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--vds-color-primary)]/10 rounded-lg">
              <FileText className="w-5 h-5 text-[var(--vds-color-primary)]" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="text-sm text-[var(--vds-color-text-muted)]">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="text-xs font-medium text-[var(--vds-color-text-muted)] uppercase tracking-wider">
            Export Options ({selectedCount} selected)
          </div>

          {(Object.keys(optionLabels) as ExportOption[]).map((key) => (
            <div key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--vds-color-surface)] transition-colors">
              <Checkbox
                id={key}
                checked={options[key]}
                onCheckedChange={(checked) => handleOptionChange(key, !!checked)}
                disabled={isExporting}
              />
              <Label
                htmlFor={key}
                className="text-sm font-medium text-[var(--vds-color-text-primary)] cursor-pointer flex-1"
              >
                {optionLabels[key]}
              </Label>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || !hasSelection}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" aria-hidden="true" />
                Export PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

ExportModal.displayName = "ExportModal";
