// Only export the component for fast refresh compatibility
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState({
    valueTree: true,
    financials: true,
    benchmarks: true,
    realization: false,
  });

  const handleExport = () => {
    setIsExporting(true);
    // Simulate export process
    setTimeout(() => {
      setIsExporting(false);
      alert("Export complete! Your file is ready.");
      onClose();
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Business Case</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground mb-2">
            Select the components you want to include in your export.
          </p>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="valueTree"
              checked={options.valueTree}
              onCheckedChange={(checked) => setOptions({ ...options, valueTree: !!checked })}
            />
            <Label htmlFor="valueTree">Value Tree Visualization</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="financials"
              checked={options.financials}
              onCheckedChange={(checked) => setOptions({ ...options, financials: !!checked })}
            />
            <Label htmlFor="financials">Financial Projections (NPV/IRR)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="benchmarks"
              checked={options.benchmarks}
              onCheckedChange={(checked) => setOptions({ ...options, benchmarks: !!checked })}
            />
            <Label htmlFor="benchmarks">ESO Benchmarks & Provenance</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="realization"
              checked={options.realization}
              onCheckedChange={(checked) => setOptions({ ...options, realization: !!checked })}
            />
            <Label htmlFor="realization">Realization Variance Analysis</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Generating PDF..." : "Export to PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
