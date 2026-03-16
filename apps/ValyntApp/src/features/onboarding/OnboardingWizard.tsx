/**
 * Onboarding Wizard - stub declaration.
 * TODO: Replace with full implementation.
 */
import * as React from "react";

export interface OnboardingWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function OnboardingWizard(_props: OnboardingWizardProps): React.ReactElement {
  return React.createElement("div", null, "Onboarding Wizard");
}
