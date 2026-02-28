import { ExternalLink, FileText, ShieldCheck } from "lucide-react";
import React from "react";

import type { VMRTLog } from "../features/workflow/services/IntegrityService";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";


interface VMRTPanelProps {
  isOpen: boolean;
  onClose: () => void;
  log: VMRTLog | null;
}

export const VMRTPanel: React.FC<VMRTPanelProps> = ({ isOpen, onClose, log }) => {
  if (!log) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md border-l-indigo-500 border-l-2">
        <SheetHeader className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">
              VMRT Reasoning Trace
            </span>
          </div>
          <SheetTitle className="text-xl font-bold">Audit Trail: {log.metricId}</SheetTitle>
          <SheetDescription className="text-xs font-mono">
            Trace ID: {log.id} | Hash: {log.hash}
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-6" />

        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          <div className="space-y-6">
            <section>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Executive Reasoning
              </h4>
              <div className="p-4 bg-muted/30 rounded-lg border text-sm leading-relaxed italic text-slate-700 dark:text-slate-300">
                "{log.reasoning}"
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold mb-3">Financial Validation</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-md bg-slate-50">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Original Input</p>
                  <p className="text-lg font-bold">{log.originalValue.toString()}%</p>
                </div>
                <div className="p-3 border rounded-md bg-indigo-50 border-indigo-100">
                  <p className="text-[10px] uppercase text-indigo-600 mb-1">Validated Value</p>
                  <p className="text-lg font-bold text-indigo-700">
                    {log.validatedValue.toString()}%
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold mb-3">Ground Truth Sources</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-md text-sm hover:bg-accent transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Tier 1
                    </Badge>
                    <span>SEC EDGAR (10-K)</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md text-sm hover:bg-accent transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      Tier 2
                    </Badge>
                    <span>ESO Industry Benchmarks</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              </div>
            </section>

            <section className="pt-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-md">
                <p className="text-[10px] font-bold text-amber-800 uppercase mb-1">
                  Integrity Veto Status
                </p>
                <p className="text-xs text-amber-700">
                  This metric was validated by the IntegrityAgent using conservative quantification
                  principles. The value was adjusted to align with the 75th percentile of industry
                  peers.
                </p>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
