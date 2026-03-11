/*
 * WireframeRouter — Route definitions for all Agentic UI wireframe screens.
 *
 * All routes are nested under /wireframes/* and wrapped by WireframeShell
 * which provides the dark theme, providers, and global overlays.
 *
 * These wireframes use mock data only — no backend integration.
 * They serve as the design reference for the ValueOS Agentic UI.
 */
import { Route, Switch } from "wouter";
import WireframeShell from "@/components/wireframes/WireframeShell";

// Wireframe pages
import WireframesHome from "./WireframesHome";
import ValueCommandCenter from "./ValueCommandCenter";
import ValueCaseWorkspace from "./ValueCaseWorkspace";
import DecisionCanvas from "./DecisionCanvas";
import ValueMaturityBoard from "./ValueMaturityBoard";
import EvidenceGraph from "./EvidenceGraph";
import DecisionDesk from "./DecisionDesk";
import PolicyGovernance from "./PolicyGovernance";
import RealizationDashboard from "./RealizationDashboard";
import OnboardingWizard from "./OnboardingWizard";
import ExpansionView from "./ExpansionView";
import WireframesNotFound from "./WireframesNotFound";

export default function WireframeRouter() {
  return (
    <WireframeShell>
      <Switch>
        <Route path="/wireframes" component={WireframesHome} />
        <Route path="/wireframes/command-center" component={ValueCommandCenter} />
        <Route path="/wireframes/workspace/:id" component={ValueCaseWorkspace} />
        <Route path="/wireframes/canvas" component={DecisionCanvas} />
        <Route path="/wireframes/maturity" component={ValueMaturityBoard} />
        <Route path="/wireframes/evidence" component={EvidenceGraph} />
        <Route path="/wireframes/decisions" component={DecisionDesk} />
        <Route path="/wireframes/governance" component={PolicyGovernance} />
        <Route path="/wireframes/realization" component={RealizationDashboard} />
        <Route path="/wireframes/onboarding" component={OnboardingWizard} />
        <Route path="/wireframes/expansion" component={ExpansionView} />
        <Route component={WireframesNotFound} />
      </Switch>
    </WireframeShell>
  );
}
