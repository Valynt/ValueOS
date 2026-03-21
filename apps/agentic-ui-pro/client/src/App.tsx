/*
 * DESIGN SYSTEM: Obsidian Enterprise
 * Dark mode default. All routes defined here.
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import PatternsPage from "./pages/PatternsPage";
import PatternDetailPage from "./pages/PatternDetailPage";
import WorkflowsPage from "./pages/WorkflowsPage";
import WorkflowDetailPage from "./pages/WorkflowDetailPage";
import PromptLabPage from "./pages/PromptLabPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/patterns" component={PatternsPage} />
      <Route path="/patterns/:id" component={PatternDetailPage} />
      <Route path="/workflows" component={WorkflowsPage} />
      <Route path="/workflows/:id" component={WorkflowDetailPage} />
      <Route path="/prompt-lab" component={PromptLabPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
