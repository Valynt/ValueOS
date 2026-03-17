import { useEffect, useRef } from "react";
import { Route, Switch, useLocation } from "wouter";

import ErrorBoundary from "./components/ErrorBoundary";
import { RouteGuard } from "./components/RouteGuard";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { catchAllRoute, protectedRoutes, publicRoutes } from "./routes";


function RouteFocusManager() {
  const [location] = useLocation();
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (!hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const mainTarget = document.getElementById("main-content") ?? document.querySelector<HTMLElement>("main");
      if (!mainTarget) {
        return;
      }

      if (!mainTarget.hasAttribute("tabindex")) {
        mainTarget.setAttribute("tabindex", "-1");
      }

      mainTarget.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location]);

  return null;
}

function Router() {
  return (
    <Switch>
      {publicRoutes.map((route) => (
        <Route key={route.path} path={route.path} component={route.component as any} />
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
            <RouteFocusManager />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </div>
    </ErrorBoundary>
  );
}

export default App;
