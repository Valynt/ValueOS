import { AppProviders } from "@app/providers/AppProviders";

import AppRoutes from "./AppRoutes";
import { useWebVitals } from "./hooks/useWebVitals";

export function App() {
  useWebVitals();

  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
