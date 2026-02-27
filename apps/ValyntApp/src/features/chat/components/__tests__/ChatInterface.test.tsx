import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInterface } from "../ChatInterface";
import type { ChatMessage } from "../../types";

// Mock scrollIntoView
const scrollIntoViewMock = vi.fn();
window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

describe("ChatInterface Accessibility", () => {
  const mockMessages: ChatMessage[] = [
    {
      id: "1",
      role: "user",
      content: "Hello",
      timestamp: new Date().toISOString(),
    },
    {
      id: "2",
      role: "assistant",
      content: "Hi there!",
      timestamp: new Date().toISOString(),
    },
  ];

  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with accessible labels", () => {
    render(
      <ChatInterface
        messages={mockMessages}
        isStreaming={false}
        onSendMessage={mockOnSendMessage}
      />
    );

    // Input should have a label
    expect(screen.getByLabelText(/chat message/i)).toBeInTheDocument();

    // Send button should have a label
    expect(screen.getByLabelText(/send message/i)).toBeInTheDocument();
  });

  it("message list has correct aria roles", () => {
    render(
      <ChatInterface
        messages={mockMessages}
        isStreaming={false}
        onSendMessage={mockOnSendMessage}
      />
    );

    // The message container should be a live region
    const list = screen.getByRole("log");
    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute("aria-live", "polite");
  });

  it("shows accessible loading state", () => {
    render(
      <ChatInterface
        messages={mockMessages}
        isStreaming={true}
        onSendMessage={mockOnSendMessage}
      />
    );

    // Should indicate agent is typing/processing
    expect(screen.getByText(/agent is typing/i)).toBeInTheDocument();
  });

  it("disables input and button when streaming", () => {
    render(
      <ChatInterface
        messages={mockMessages}
        isStreaming={true}
        onSendMessage={mockOnSendMessage}
      />
    );

    expect(screen.getByLabelText(/chat message/i)).toBeDisabled();
    expect(screen.getByLabelText(/send message/i)).toBeDisabled();
  });

  it("calls onSendMessage when submitted", () => {
    render(
      <ChatInterface
        messages={mockMessages}
        isStreaming={false}
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = screen.getByLabelText(/chat message/i);
    fireEvent.change(input, { target: { value: "New message" } });

    const button = screen.getByLabelText(/send message/i);
    fireEvent.click(button);

    expect(mockOnSendMessage).toHaveBeenCalledWith("New message");
  });
});
