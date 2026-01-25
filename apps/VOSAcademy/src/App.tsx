import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { RouteGuard } from "./components/RouteGuard";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  catchAllRoute,
  protectedRoutes,
  publicRoutes,
} from "./routes";

function Router() {
  return (
    <Switch>
      {publicRoutes.map((route) => (
        <Route key={route.path} path={route.path} component={route.component} />
      ))}
      {protectedRoutes.map((route) => (
        <Route key={route.path} path={route.path}>
          {() => (
            <RouteGuard requiredRole={route.requiredRole}>
              <route.component />
            </RouteGuard>
          )}
        </Route>
      ))}
      <Route component={catchAllRoute.component} />
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
