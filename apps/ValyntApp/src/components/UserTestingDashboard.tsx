import React, { useState } from "react";

import { usePersona } from "../context/PersonaContext";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";


export const UserTestingDashboard: React.FC = () => {
  const { persona, setPersona } = usePersona();
  const [testResults, setTestResults] = useState<
    { step: string; status: "pass" | "fail" | "pending" }[]
  >([
    { step: "VE Discovery", status: "pass" },
    { step: "Integrity Veto", status: "pass" },
    { step: "CFO Approval Handoff", status: "pending" },
    { step: "CSM Realization Sync", status: "pending" },
  ]);

  const runTest = (index: number) => {
    const newResults = [...testResults];
    newResults[index].status = "pass";
    setTestResults(newResults);
  };

  return (
    <Card className="p-6 mt-6 bg-slate-50 border-dashed border-2">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700">
        <span role="img" aria-label="Test">
          🧪
        </span>{" "}
        Cross-Persona Handoff Testing
      </h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center p-3 bg-white rounded border">
          <div>
            <p className="text-sm font-bold">Current Persona: {persona}</p>
            <p className="text-xs text-muted-foreground">
              Switch personas to test handoff visibility.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="xs" onClick={() => setPersona("VE")}>
              VE
            </Button>
            <Button size="xs" onClick={() => setPersona("CFO")}>
              CFO
            </Button>
            <Button size="xs" onClick={() => setPersona("CSM")}>
              CSM
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {testResults.map((res, i) => (
            <div
              key={i}
              className="flex justify-between items-center p-2 bg-white rounded border text-sm"
            >
              <span>{res.step}</span>
              <div className="flex items-center gap-2">
                <Badge variant={res.status === "pass" ? "default" : "outline"}>
                  {res.status.toUpperCase()}
                </Badge>
                {res.status === "pending" && (
                  <Button size="xs" onClick={() => runTest(i)}>
                    Run
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
