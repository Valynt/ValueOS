import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AcademyAITutor from "./AcademyAITutor";
import { BrowserRouter } from "react-router-dom";

describe("AcademyAITutor", () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <AcademyAITutor />
      </BrowserRouter>
    );
  };

  it("renders with accessible inputs and buttons", () => {
    renderComponent();

    // Check for "Ask a question" input label
    expect(screen.getByLabelText(/Ask a question/i)).toBeInTheDocument();

    // Check for "Send message" button label
    expect(screen.getByRole("button", { name: /Send message/i })).toBeInTheDocument();
  });
});
