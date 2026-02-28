import {
  ArrowRight,
  FileBox,
  FileText,
  Link as LinkIcon,
  Mail,
  Mic,
  Plus,
  Search,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { createSearchParams, useNavigate } from "react-router-dom";

import { ActionCard } from "@/components/Common/ActionCard";
import { Button } from "@/components/Common/Button";

// Modals
import { CRMImportModal } from "@/components/Modals/CRMImportModal";
import { EmailAnalysisModal } from "@/components/Modals/EmailAnalysisModal";
import { ResearchCompanyModal } from "@/components/Modals/ResearchCompanyModal";
import { SalesCallModal } from "@/components/Modals/SalesCallModal";
import { TemplateSelectorModal } from "@/components/Modals/TemplateSelectorModal";
import { UploadNotesModal } from "@/components/Modals/UploadNotesModal";

type ActiveModal =
  | null
  | "sales-call"
  | "crm-import"
  | "upload-notes"
  | "email-analysis"
  | "research"
  | "template";

type ActionId =
  | "analyze-call"
  | "import-crm"
  | "upload-notes"
  | "email-thread"
  | "research-company"
  | "template-selector"
  | "new-case";

export default function MissionControl() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const closeModal = () => setActiveModal(null);

  const handleAction = (actionId: ActionId) => {
    switch (actionId) {
      case "analyze-call":
        setActiveModal("sales-call");
        break;
      case "import-crm":
        setActiveModal("crm-import");
        break;
      case "upload-notes":
        setActiveModal("upload-notes");
        break;
      case "email-thread":
        setActiveModal("email-analysis");
        break;
      case "research-company":
        setActiveModal("research");
        break;
      case "template-selector":
        setActiveModal("template");
        break;
      case "new-case":
        navigate("/canvas");
        break;
      default:
        // Exhaustiveness guard
        ((_: never) => _)(actionId);
    }
  };

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    navigate({
      pathname: "/canvas",
      search: createSearchParams({ q }).toString(),
    });
  };

  // --- Completion Handlers (routing to Canvas) ---
  const handleSalesCallComplete = (analysis: unknown) => {
    closeModal();
    navigate("/canvas", { state: { source: "sales-call", data: analysis } });
  };

  const handleCRMImportComplete = (valueCase: unknown, deal: unknown) => {
    closeModal();
    navigate("/canvas", { state: { source: "crm", data: valueCase, deal } });
  };

  const handleUploadComplete = (files: unknown) => {
    closeModal();
    navigate("/canvas", { state: { source: "upload", data: files } });
  };

  const handleEmailAnalysisComplete = (content: unknown) => {
    closeModal();
    navigate("/canvas", { state: { source: "email", data: content } });
  };

  const handleResearchComplete = (domain: string) => {
    closeModal();
    navigate("/canvas", { state: { source: "research", domain } });
  };

  const handleTemplateSelect = (templateId: string) => {
    closeModal();
    navigate("/canvas", { state: { source: "template", templateId } });
  };

  const actionCards = useMemo(
    () => [
      {
        id: "analyze-call" as const,
        icon: <Mic className="w-8 h-8" />,
        title: "Analyze Sales Call",
        subtitle: "Evaluate performance and key moments from recordings.",
      },
      {
        id: "import-crm" as const,
        icon: <LinkIcon className="w-8 h-8" />,
        title: "Import from CRM",
        subtitle: "Connect and sync your customer data from Salesforce/HubSpot.",
      },
      {
        id: "upload-notes" as const,
        icon: <FileText className="w-8 h-8" />,
        title: "Upload Notes",
        subtitle: "Add existing documentation, PDFs, or text files.",
      },
      {
        id: "email-thread" as const,
        icon: <Mail className="w-8 h-8" />,
        title: "Email Thread",
        subtitle: "Parse and organize communication chains for insights.",
      },
      {
        id: "research-company" as const,
        icon: <Search className="w-8 h-8" />,
        title: "Research Company",
        subtitle: "Gather insights and background information from the web.",
      },
      {
        id: "new-case" as const,
        icon: <Plus className="w-8 h-8" />,
        title: "New Case",
        subtitle: "Start a fresh project from scratch without templates.",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-surface-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="w-full max-w-5xl flex flex-col items-center space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Start Building Value
          </h1>
          <p className="text-lg text-text-muted">
            Create a new case or import data to begin
          </p>
        </div>

        {/* Prompt */}
        <div className="w-full max-w-3xl relative group">
          <div className="absolute inset-0 bg-teal-500/20 rounded-xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative bg-surface-2 border border-border group-hover:border-teal-500/50 rounded-xl shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-48 focus-within:ring-2 focus-within:ring-teal-500/50">
            <textarea
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="e.g. Analyze Salesforce's latest 10-K report. Map out the top 3 value drivers for their Sales Cloud product..."
              className="w-full h-full p-6 bg-transparent text-lg text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none font-sans leading-relaxed"
            />
            <div className="absolute bottom-4 right-4">
              <Button
                variant="primary"
                size="sm"
                className="rounded-full w-10 h-10 p-0 flex items-center justify-center shadow-glow"
                onClick={handleSearch}
                disabled={!searchQuery.trim()}
                aria-label="Run prompt"
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Action Cards Grid (now actually used) */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actionCards.map((card) => (
            <ActionCard
              key={card.id}
              icon={card.icon}
              title={card.title}
              subtitle={card.subtitle}
              onClick={() => handleAction(card.id)}
            />
          ))}
        </div>

        {/* Row 1: Primary Quick Actions */}
        <div className="flex flex-wrap justify-center gap-4 w-full pt-2">
          <QuickActionButton
            icon={<Mic className="w-4 h-4" />}
            label="Analyze Sales Call"
            onClick={() => handleAction("analyze-call")}
          />
          <QuickActionButton
            icon={<Search className="w-4 h-4" />}
            label="Research Company"
            onClick={() => handleAction("research-company")}
          />
          <QuickActionButton
            icon={<LinkIcon className="w-4 h-4" />}
            label="Link CRM Record"
            onClick={() => handleAction("import-crm")}
          />
        </div>

        {/* Row 2: Secondary / Heavy Actions */}
        <div className="flex flex-wrap justify-center gap-6 w-full pt-4 border-t border-border/50">
          <Button
            variant="secondary"
            className="h-12 px-8 rounded-lg text-base font-medium border-border-strong bg-surface-2 hover:bg-surface-3 hover:border-text-muted/50 transition-all"
            onClick={() => handleAction("upload-notes")}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-text-muted" />
              Import Existing Model
            </div>
          </Button>

          <Button
            variant="secondary"
            className="h-12 px-8 rounded-lg text-base font-medium border-border-strong bg-surface-2 hover:bg-surface-3 hover:border-text-muted/50 transition-all"
            onClick={() => handleAction("template-selector")}
          >
            <div className="flex items-center gap-2">
              <FileBox className="w-4 h-4 text-text-muted" />
              Start From Template
            </div>
          </Button>
        </div>
      </div>

      {/* --- Modals --- */}

      {activeModal === "sales-call" && (
        <SalesCallModal
          isOpen={true}
          onClose={closeModal}
          onComplete={handleSalesCallComplete}
        />
      )}

      {activeModal === "crm-import" && (
        <CRMImportModal
          isOpen={true}
          onClose={closeModal}
          onComplete={handleCRMImportComplete}
          tenantId="demo-tenant"
          userId="demo-user"
        />
      )}

      {activeModal === "upload-notes" && (
        <UploadNotesModal
          isOpen={true}
          onClose={closeModal}
          onComplete={handleUploadComplete}
        />
      )}

      {activeModal === "email-analysis" && (
        <EmailAnalysisModal
          isOpen={true}
          onClose={closeModal}
          onComplete={handleEmailAnalysisComplete}
        />
      )}

      {activeModal === "research" && (
        <ResearchCompanyModal
          isOpen={true}
          onClose={closeModal}
          onResearch={handleResearchComplete}
        />
      )}

      {activeModal === "template" && (
        <TemplateSelectorModal
          isOpen={true}
          onClose={closeModal}
          onSelect={handleTemplateSelect}
        />
      )}
    </div>
  );
}

const QuickActionButton = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-3 px-6 py-3 bg-surface-1 border border-border font-medium text-foreground rounded-full hover:bg-surface-2 hover:border-teal-500/50 hover:text-teal-400 transition-all duration-200 group shadow-sm hover:shadow-glow"
  >
    <div className="text-teal-500 group-hover:text-teal-400 transition-colors">
      {icon}
    </div>
    {label}
  </button>
);
