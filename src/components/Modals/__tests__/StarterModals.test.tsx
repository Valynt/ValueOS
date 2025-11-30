/**
 * Starter Modals Tests
 *
 * Tests for Upload Notes, Email Analysis, CRM Import, and Sales Call modals.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock services before importing components
vi.mock("../../../services/DocumentParserService", () => ({
  documentParserService: {
    parseAndExtract: vi.fn().mockResolvedValue({
      content: "Test content",
      metadata: {},
      insights: {
        companyName: "Acme Corp",
        painPoints: ["slow processes"],
        stakeholders: [{ name: "John", role: "decision_maker" }],
        summary: "Test summary",
      },
    }),
  },
}));

vi.mock("../../../services/EmailAnalysisService", () => ({
  emailAnalysisService: {
    analyzeEmail: vi.fn().mockResolvedValue({
      summary: "Email about pricing discussion",
      sentiment: "positive",
      urgency: "high",
      participants: [
        {
          name: "John Doe",
          email: "john@acme.com",
          role: "prospect",
          sentiment: "positive",
        },
      ],
      keyAsks: ["Pricing breakdown"],
      objections: [],
      dealSignals: ["Ready to move forward"],
      suggestedNextSteps: ["Send proposal"],
    }),
  },
}));

vi.mock("../../../services/CallAnalysisService", () => ({
  callAnalysisService: {
    transcribe: vi.fn().mockResolvedValue({
      transcript: "Hello, this is a sales call...",
      duration: 300,
      language: "en",
    }),
    analyzeTranscript: vi.fn().mockResolvedValue({
      summary: "Discovery call with prospect",
      duration: 300,
      participants: [],
      painPoints: ["Manual data entry"],
      objections: [],
      competitorsMentioned: [],
      pricingDiscussed: false,
      budgetMentioned: true,
      timelineMentioned: true,
      nextSteps: ["Send demo"],
      buyingSignals: ["Asked about pricing"],
      warningFlags: [],
      callScore: 7,
      scoreBreakdown: {
        discovery: 8,
        valueArticulation: 7,
        objectionHandling: 6,
        nextStepsClarity: 7,
      },
      keyQuotes: [],
      coachingTips: ["Ask more open-ended questions"],
    }),
    formatDuration: vi.fn(
      (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`,
    ),
  },
}));

vi.mock("../../../services/CRMOAuthService", () => ({
  crmOAuthService: {
    getStatus: vi.fn().mockResolvedValue({
      hubspot: { connected: true, status: "active" },
      salesforce: { connected: false, status: "not_connected" },
    }),
  },
}));

vi.mock("../../../mcp-crm", () => ({
  getMCPCRMServer: vi.fn().mockReturnValue({
    executeTool: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: "deal-123",
        name: "Enterprise Deal",
        stage: "Qualified",
        amount: 50000,
        companyName: "Test Corp",
      },
    }),
  }),
}));

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { access_token: "test-token", user: { id: "user-1" } },
        },
      }),
    },
  },
}));

// Import components after mocks
import { UploadNotesModal } from "../UploadNotesModal";
import { EmailAnalysisModal } from "../EmailAnalysisModal";
import { SalesCallModal } from "../SalesCallModal";
import { CRMImportModal } from "../CRMImportModal";

// ============================================================================
// Upload Notes Modal Tests
// ============================================================================

describe("UploadNotesModal", () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    render(
      <UploadNotesModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    expect(screen.getByText(/Upload Notes/i)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <UploadNotesModal
        isOpen={false}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    expect(screen.queryByText(/Upload Meeting Notes/i)).not.toBeInTheDocument();
  });

  it("allows pasting text notes", async () => {
    const user = userEvent.setup();

    render(
      <UploadNotesModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    // Find and click paste tab
    const pasteTab = screen.getByText(/Paste Text/i);
    await user.click(pasteTab);

    // Find textarea and type
    const textarea = screen.getByPlaceholderText(/Paste your meeting notes/i);
    await user.type(textarea, "Meeting with Acme Corp about their pain points");

    expect(textarea).toHaveValue(
      "Meeting with Acme Corp about their pain points",
    );
  });

  it("shows file upload zone", () => {
    render(
      <UploadNotesModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    expect(screen.getByText(/Drop your file here/i)).toBeInTheDocument();
  });

  it("preselects an initial file when provided", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain", lastModified: 0 });

    render(
      <UploadNotesModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        initialFile={file}
      />,
    );

    expect(await screen.findByText(/notes\.txt/i)).toBeInTheDocument();
  });

  it("calls onClose when cancel is clicked", async () => {
    const user = userEvent.setup();

    render(
      <UploadNotesModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    const cancelButton = screen.getByText(/Cancel/i);
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

// ============================================================================
// Email Analysis Modal Tests
// ============================================================================

describe("EmailAnalysisModal", () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    render(
      <EmailAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    expect(screen.getByText(/Analyze Email Thread/i)).toBeInTheDocument();
  });

  it("allows pasting email content", async () => {
    const user = userEvent.setup();

    render(
      <EmailAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Paste your email thread/i);
    await user.type(
      textarea,
      "From: john@acme.com\nSubject: Pricing\n\nHi, interested in your product.",
    );

    expect(textarea).toHaveValue(
      "From: john@acme.com\nSubject: Pricing\n\nHi, interested in your product.",
    );
  });

  it("shows analyze button", () => {
    render(
      <EmailAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Analyze Thread/i }),
    ).toBeInTheDocument();
  });
});

// ============================================================================
// CRM Import Modal Tests
// ============================================================================

describe("CRMImportModal", () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", async () => {
    render(
      <CRMImportModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        tenantId="tenant-123"
        userId="user-123"
      />,
    );

    expect(screen.getByText(/Import from CRM/i)).toBeInTheDocument();
    await screen.findByText(/Connected: HubSpot/i);
  });

  it("shows URL input field", async () => {
    render(
      <CRMImportModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        tenantId="tenant-123"
        userId="user-123"
      />,
    );

    const urlInput = await screen.findByPlaceholderText(
      /hubspot\.com\/contacts\/.+deal/i,
    );
    expect(urlInput).toBeInTheDocument();
  });

  it("detects HubSpot URL format", async () => {
    const user = userEvent.setup();

    render(
      <CRMImportModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        tenantId="tenant-123"
        userId="user-123"
      />,
    );

    const input = await screen.findByPlaceholderText(
      /hubspot\.com\/contacts\/.+deal/i,
    );

    await user.type(input, "https://app.hubspot.com/contacts/12345/deal/67890");

    await waitFor(() => {
      expect(screen.getByText(/HubSpot deal detected/i)).toBeInTheDocument();
    });
  });

  it("has tabs for URL and Search", async () => {
    render(
      <CRMImportModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        tenantId="tenant-123"
        userId="user-123"
      />,
    );

    await screen.findByText(/Connected: HubSpot/i);
    expect(screen.getByText(/Paste URL/i)).toBeInTheDocument();
    expect(screen.getByText(/Search Deals/i)).toBeInTheDocument();
  });
});

// ============================================================================
// Sales Call Modal Tests
// ============================================================================

describe("SalesCallModal", () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    render(
      <SalesCallModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    expect(screen.getByText(/Analyze Sales Call/i)).toBeInTheDocument();
  });

  it("shows upload zone", () => {
    render(
      <SalesCallModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    expect(screen.getByText(/Drop your recording here/i)).toBeInTheDocument();
  });

  it("shows supported formats", () => {
    render(
      <SalesCallModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    expect(screen.getByText(/MP3, MP4, M4A, WAV, WebM/i)).toBeInTheDocument();
  });

  it("shows what analysis includes", () => {
    render(
      <SalesCallModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    expect(screen.getByText(/Full transcript/i)).toBeInTheDocument();
    expect(screen.getByText(/Pain points identified/i)).toBeInTheDocument();
    expect(screen.getByText(/Objections & responses/i)).toBeInTheDocument();
  });

  it("analyze button is disabled without file", () => {
    render(
      <SalesCallModal
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />,
    );

    const analyzeButton = screen.getByText(/Analyze Call/i);
    expect(analyzeButton).toBeDisabled();
  });
});
