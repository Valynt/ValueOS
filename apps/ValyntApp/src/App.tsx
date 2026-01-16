import { AppProviders } from "@app/providers/AppProviders";
import AppRoutes from "./AppRoutes";

export function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
