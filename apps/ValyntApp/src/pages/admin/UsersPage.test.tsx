import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import UsersPage from "./UsersPage";

describe("UsersPage", () => {
  it("renders with accessible inputs and buttons", () => {
    render(<UsersPage />);

    // Check for "Search users" input label
    expect(screen.getByLabelText(/Search users/i)).toBeInTheDocument();

    // Check for "More actions" button label
    // There are multiple users, so multiple buttons.
    const moreButtons = screen.getAllByRole("button", { name: /More actions/i });
    expect(moreButtons.length).toBeGreaterThan(0);
  });
});
