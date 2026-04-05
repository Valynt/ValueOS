import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthLayout } from "./AuthLayout";

describe("AuthLayout", () => {
  it("uses ValueOS branding in auth header and footer", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<div>Login Form</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "ValueOS" })).toBeInTheDocument();
    expect(screen.getByText(/All rights reserved\./i)).toHaveTextContent("ValueOS");
    expect(screen.queryByText(/Valynt/i)).not.toBeInTheDocument();
  });
});
