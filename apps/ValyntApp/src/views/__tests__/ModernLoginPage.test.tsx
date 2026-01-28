import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import { ModernLoginPage } from "../Auth/ModernLoginPage";
import { BrowserRouter } from "react-router-dom";

// Mock AuthContext
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: vi.fn(),
    signInWithProvider: vi.fn(),
  }),
}));

describe("ModernLoginPage", () => {
  it("renders without crashing", () => {
    render(
      <BrowserRouter>
         <ModernLoginPage />
      </BrowserRouter>
    );
  });
});
