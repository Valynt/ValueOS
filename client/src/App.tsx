import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider } from "./contexts/AppContext";
import { MainLayout } from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Cases from "./pages/Cases";
import CaseCanvas from "./pages/CaseCanvas";
import MyWork from "./pages/MyWork";
import Models from "./pages/Models";
import Agents from "./pages/Agents";
import CompanyIntel from "./pages/CompanyIntel";
import Settings from "./pages/Settings";
import Ask from "./pages/Ask";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/cases" component={Cases} />
        <Route path="/cases/:caseId" component={CaseCanvas} />
        <Route path="/my-work" component={MyWork} />
        <Route path="/models" component={Models} />
        <Route path="/agents" component={Agents} />
        <Route path="/company-intel" component={CompanyIntel} />
        <Route path="/settings" component={Settings} />
        <Route path="/ask" component={Ask} />
        {/* Legacy routes */}
        <Route path="/opportunities" component={Cases} />
        <Route path="/opportunities/:caseId" component={CaseCanvas} />
        <Route path="/opportunities/:id/cases/:caseId" component={CaseCanvas} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
