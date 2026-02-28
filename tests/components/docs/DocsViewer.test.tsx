/**
 * Component Test - DocsViewer
 *
 * Tests for the DocsViewer component that uses react-markdown,
 * react-syntax-highlighter, and remark-gfm:
 * - Markdown rendering with GFM support
 * - Syntax highlighting for code blocks
 * - Role-based content filtering
 * - Table of contents generation
 * - Breadcrumb navigation
 * - Copy button functionality
 * - Accessibility features
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";
import { DocsViewer } from "../../../src/components/docs/DocsViewer";
import type { DocSection, UserRole } from "../../../src/components/docs/types";

describe("DocsViewer Component", () => {
  const mockOnNavigate = vi.fn();

  const mockSection: DocSection = {
    id: "test-section",
    title: "Test Documentation",
    description: "A test documentation section",
    content: `# Introduction

This is a test document with **bold** and *italic* text.

## Code Example

\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

## Features

- Feature 1
- Feature 2
- Feature 3

### Subsection

More content here.`,
    category: "user-guide",
    lastUpdated: "2026-01-05T00:00:00Z",
    estimatedTime: "5 min read",
    difficulty: "beginner",
    metadata: {
      relatedSections: ["related-1", "related-2"],
    },
  };

  beforeEach(() => {
    mockOnNavigate.mockClear();
  });

  describe("Rendering", () => {
    it("should render null state when no section provided", () => {
      render(
        <DocsViewer
          section={null}
          userRole="business"
          onNavigate={mockOnNavigate}
        />
      );

      expect(
        screen.getByText("Select a topic to get started")
      ).toBeInTheDocument();
    });

    it("should render section title and description", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="business"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText("Test Documentation")).toBeInTheDocument();
      expect(
        screen.getByText("A test documentation section")
      ).toBeInTheDocument();
    });

    it("should render estimated time when provided", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="business"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText("5 min read")).toBeInTheDocument();
    });

    it("should render difficulty badge with correct styling", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="business"
          onNavigate={mockOnNavigate}
        />
      );

      const badge = screen.getByText("beginner");
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });

    it("should render intermediate difficulty with yellow styling", () => {
      const intermediateSection = {
        ...mockSection,
        difficulty: "intermediate" as const,
      };

      render(
        <DocsViewer
          section={intermediateSection}
          userRole="business"
          onNavigate={mockOnNavigate}
        />
      );

      const badge = screen.getByText("intermediate");
      expect(badge).toHaveClass("bg-yellow-100", "text-yellow-800");
    });

    it("should render advanced difficulty with red styling", () => {
      const advancedSection = {
        ...mockSection,
        difficulty: "advanced" as const,
      };

      render(
        <DocsViewer
          section={advancedSection}
          userRole="business"
          onNavigate={mockOnNavigate}
        />
      );

      const badge = screen.getByText("advanced");
      expect(badge).toHaveClass("bg-red-100", "text-red-800");
    });
  });

  describe("Markdown Rendering with react-markdown", () => {
    it("should render markdown content with bold text", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const boldElement = screen.getByText("bold");
      expect(boldElement.tagName).toBe("STRONG");
    });

    it("should render markdown content with italic text", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const italicElement = screen.getByText("italic");
      expect(italicElement.tagName).toBe("EM");
    });

    it("should render markdown lists", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText("Feature 1")).toBeInTheDocument();
      expect(screen.getByText("Feature 2")).toBeInTheDocument();
      expect(screen.getByText("Feature 3")).toBeInTheDocument();
    });

    it("should render GFM tables when using remark-gfm", () => {
      const sectionWithTable: DocSection = {
        ...mockSection,
        content: `| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |`,
      };

      render(
        <DocsViewer
          section={sectionWithTable}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText("Column 1")).toBeInTheDocument();
      expect(screen.getByText("Column 2")).toBeInTheDocument();
      expect(screen.getByText("Value 1")).toBeInTheDocument();
      expect(screen.getByText("Value 2")).toBeInTheDocument();
    });

    it("should render GFM strikethrough when using remark-gfm", () => {
      const sectionWithStrikethrough: DocSection = {
        ...mockSection,
        content: "This is ~~deleted~~ text",
      };

      render(
        <DocsViewer
          section={sectionWithStrikethrough}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const deletedElement = screen.getByText("deleted");
      expect(deletedElement.tagName).toBe("DEL");
    });
  });

  describe("Code Syntax Highlighting with react-syntax-highlighter", () => {
    it("should render code blocks for developer role", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText(/const greeting/)).toBeInTheDocument();
      expect(screen.getByText(/console\.log/)).toBeInTheDocument();
    });

    it("should hide code blocks for business users in technical sections", () => {
      const technicalSection: DocSection = {
        ...mockSection,
        category: "developer-guide",
      };

      render(
        <DocsViewer
          section={technicalSection}
          userRole="business"
          onNavigate={mockOnNavigate}
        />
      );

      expect(
        screen.getByText(/Developer Note: Code example available/)
      ).toBeInTheDocument();
      expect(screen.queryByText(/const greeting/)).not.toBeInTheDocument();
    });

    it("should show code blocks for admin users even in technical sections", () => {
      const technicalSection: DocSection = {
        ...mockSection,
        category: "api-reference",
      };

      render(
        <DocsViewer
          section={technicalSection}
          userRole="admin"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText(/const greeting/)).toBeInTheDocument();
    });

    it("should render inline code differently from code blocks", () => {
      const sectionWithInlineCode: DocSection = {
        ...mockSection,
        content: "Use the `console.log()` function",
      };

      render(
        <DocsViewer
          section={sectionWithInlineCode}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const inlineCode = screen.getByText("console.log()");
      expect(inlineCode.tagName).toBe("CODE");
    });
  });

  describe("Role-Based Content Filtering", () => {
    it("should show all content for developer role", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText(/const greeting/)).toBeInTheDocument();
    });

    it("should filter technical content for business role", () => {
      const technicalSection: DocSection = {
        ...mockSection,
        category: "developer-guide",
      };

      render(
        <DocsViewer
          section={technicalSection}
          userRole="business"
          onNavigate={mockOnNavigate}
        />
      );

      expect(
        screen.getByText(/Switch to developer view/)
      ).toBeInTheDocument();
    });

    it("should show all content for admin role", () => {
      const technicalSection: DocSection = {
        ...mockSection,
        category: "api-reference",
      };

      render(
        <DocsViewer
          section={technicalSection}
          userRole="admin"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText(/const greeting/)).toBeInTheDocument();
    });
  });

  describe("Table of Contents", () => {
    it("should generate table of contents from headings", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      // ToC should include h2 and h3 headings
      expect(screen.getByText("Code Example")).toBeInTheDocument();
      expect(screen.getByText("Features")).toBeInTheDocument();
      expect(screen.getByText("Subsection")).toBeInTheDocument();
    });

    it("should have toggle button for mobile", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const toggleButton = screen.getByLabelText("Toggle table of contents");
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should call onNavigate when breadcrumb is clicked", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const documentationLink = screen.getByText("Documentation");
      fireEvent.click(documentationLink);

      expect(mockOnNavigate).toHaveBeenCalledWith("overview-welcome");
    });

    it("should handle internal link navigation", () => {
      const sectionWithLink: DocSection = {
        ...mockSection,
        content: "[Related Doc](./related-section.md)",
      };

      render(
        <DocsViewer
          section={sectionWithLink}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const link = screen.getByText("Related Doc");
      fireEvent.click(link);

      expect(mockOnNavigate).toHaveBeenCalledWith("related-section");
    });

    it("should open external links in new tab", () => {
      const sectionWithExternalLink: DocSection = {
        ...mockSection,
        content: "[External](https://example.com)",
      };

      render(
        <DocsViewer
          section={sectionWithExternalLink}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const link = screen.getByText("External");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("Accessibility", () => {
    it("should have proper heading hierarchy", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent("Test Documentation");
    });

    it("should have accessible toggle button", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const toggleButton = screen.getByLabelText("Toggle table of contents");
      expect(toggleButton).toBeInTheDocument();
    });

    it("should have semantic article element for content", () => {
      const { container } = render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const article = container.querySelector("article");
      expect(article).toBeInTheDocument();
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle section without description", () => {
      const sectionWithoutDescription: DocSection = {
        ...mockSection,
        description: undefined,
      };

      render(
        <DocsViewer
          section={sectionWithoutDescription}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText("Test Documentation")).toBeInTheDocument();
    });

    it("should handle section without estimated time", () => {
      const sectionWithoutTime: DocSection = {
        ...mockSection,
        estimatedTime: undefined,
      };

      render(
        <DocsViewer
          section={sectionWithoutTime}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.queryByText(/min read/)).not.toBeInTheDocument();
    });

    it("should handle section without difficulty", () => {
      const sectionWithoutDifficulty: DocSection = {
        ...mockSection,
        difficulty: undefined,
      };

      render(
        <DocsViewer
          section={sectionWithoutDifficulty}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.queryByText("beginner")).not.toBeInTheDocument();
    });

    it("should handle empty content", () => {
      const emptySection: DocSection = {
        ...mockSection,
        content: "",
      };

      render(
        <DocsViewer
          section={emptySection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText("Test Documentation")).toBeInTheDocument();
    });

    it("should handle section without related links", () => {
      const sectionWithoutRelated: DocSection = {
        ...mockSection,
        metadata: undefined,
      };

      render(
        <DocsViewer
          section={sectionWithoutRelated}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText("Test Documentation")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed markdown gracefully", () => {
      const malformedSection: DocSection = {
        ...mockSection,
        content: "# Unclosed **bold",
      };

      expect(() => {
        render(
          <DocsViewer
            section={malformedSection}
            userRole="developer"
            onNavigate={mockOnNavigate}
          />
        );
      }).not.toThrow();
    });

    it("should handle code blocks without language specification", () => {
      const sectionWithPlainCode: DocSection = {
        ...mockSection,
        content: "```\nplain code\n```",
      };

      render(
        <DocsViewer
          section={sectionWithPlainCode}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText("plain code")).toBeInTheDocument();
    });

    it("should handle very long content", () => {
      const longContent = Array(100)
        .fill("## Section\n\nContent paragraph.\n\n")
        .join("");
      const longSection: DocSection = {
        ...mockSection,
        content: longContent,
      };

      expect(() => {
        render(
          <DocsViewer
            section={longSection}
            userRole="developer"
            onNavigate={mockOnNavigate}
          />
        );
      }).not.toThrow();
    });

    it("should handle special characters in headings", () => {
      const specialSection: DocSection = {
        ...mockSection,
        content: "## Section with <special> & characters!",
      };

      render(
        <DocsViewer
          section={specialSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(
        screen.getByText(/Section with <special> & characters!/)
      ).toBeInTheDocument();
    });
  });

  describe("Feedback Section", () => {
    it("should render feedback buttons", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByText("Was this helpful?")).toBeInTheDocument();
      expect(screen.getByText("👍 Yes")).toBeInTheDocument();
      expect(screen.getByText("👎 No")).toBeInTheDocument();
    });

    it("should have clickable feedback buttons", () => {
      render(
        <DocsViewer
          section={mockSection}
          userRole="developer"
          onNavigate={mockOnNavigate}
        />
      );

      const yesButton = screen.getByText("👍 Yes");
      const noButton = screen.getByText("👎 No");

      expect(yesButton.tagName).toBe("BUTTON");
      expect(noButton.tagName).toBe("BUTTON");
    });
  });
});
