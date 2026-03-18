/**
 * OnboardingWizard — orchestrates full onboarding flow:
 *   Phase A: Org + role setup (delegates to SetupWizard)
 *   Phase B: Invite team members
 *   Phase C: Create first value case (optional, skippable)
 */

import { ChevronRight, Loader2, Mail, Plus, X } from "lucide-react";
import { useState } from "react";

import { type SetupData, SetupWizard } from "./SetupWizard";

import { apiClient } from "@/api/client/unified-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface OnboardingWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

type Phase = "setup" | "invite" | "first-case";

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [caseName, setCaseName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSetupComplete = (data: SetupData) => {
    setSetupData(data);
    setPhase("invite");
  };

  const addEmail = () => {
    const trimmed = emailInput.trim();
    if (trimmed && !inviteEmails.includes(trimmed)) {
      setInviteEmails((prev) => [...prev, trimmed]);
    }
    setEmailInput("");
  };

  const removeEmail = (email: string) => {
    setInviteEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleInviteSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (inviteEmails.length > 0) {
        await Promise.allSettled(
          inviteEmails.map((email) =>
            apiClient.post("/api/teams/current/invites", { email, role: "member" }),
          ),
        );
      }
    } finally {
      setIsSubmitting(false);
      setPhase("first-case");
    }
  };

  const handleCreateCase = async () => {
    if (!caseName.trim()) {
      onComplete?.();
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/api/cases", {
        name: caseName.trim(),
        company: setupData?.companyName,
      });
    } finally {
      setIsSubmitting(false);
      onComplete?.();
    }
  };

  if (phase === "setup") {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  if (phase === "invite") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-xl">
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Invite your team</p>
              <h1 className="text-2xl font-semibold">Who should join you?</h1>
              <p className="text-sm text-muted-foreground">
                Add teammates by email. They'll get an invite to your workspace.
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="colleague@company.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmail();
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={addEmail} disabled={!emailInput.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {inviteEmails.length > 0 && (
              <div className="space-y-2">
                {inviteEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {email}
                    </span>
                    <button onClick={() => removeEmail(email)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setPhase("first-case")}>
                Skip
              </Button>
              <Button onClick={handleInviteSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {inviteEmails.length > 0 ? "Send Invites" : "Continue"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-xl">
        <CardContent className="p-8 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Almost done</p>
            <h1 className="text-2xl font-semibold">Create your first Value Case</h1>
            <p className="text-sm text-muted-foreground">
              Give it a name to get started, or skip and create one later.
            </p>
          </div>

          <Input
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            placeholder="e.g. Enterprise License Expansion – Acme Corp"
            autoFocus
          />

          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onSkip ?? onComplete}>
              Skip
            </Button>
            <Button onClick={handleCreateCase} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {caseName.trim() ? "Create & Continue" : "Finish Setup"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
