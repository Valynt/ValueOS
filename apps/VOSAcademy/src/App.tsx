import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import PillarOverview from "./pages/PillarOverview";
import Quiz from "./pages/Quiz";
import AITutor from "./pages/AITutor";
import Profile from "./pages/Profile";
import Resources from "./pages/Resources";
import Certifications from "./pages/Certifications";
import { Simulations } from "./pages/Simulations";
import { SimulationProgress } from "./pages/SimulationProgress";
import Analytics from "./pages/Analytics";
import ValueTreeBuilder from "./pages/ValueTreeBuilder";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/pillar/:pillarNumber"} component={PillarOverview} />
      <Route path="/quiz/:pillarNumber" component={Quiz} />
      <Route path="/ai-tutor" component={AITutor} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/resources"} component={Resources} />
      <Route path={"/certifications"} component={Certifications} />
      <Route path={"/simulations"} component={Simulations} />
      <Route path={"/simulation-progress"} component={SimulationProgress} />
      <Route path={"/analytics"} component={Analytics} />
      <Route path={"/value-tree-builder"} component={ValueTreeBuilder} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <div className="bg-background text-foreground min-h-screen overflow-x-hidden w-full">
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </div>
    </ErrorBoundary>
  );
}

export default App;
