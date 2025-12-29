/**
 * CitationTooltip Storybook Stories
 */

import type { Meta, StoryObj } from "@storybook/react";
import { CitationTooltip } from "./CitationTooltip";

const meta: Meta<typeof CitationTooltip> = {
  title: "Atoms/CitationTooltip",
  component: CitationTooltip,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "CitationTooltip displays source information for verified data. Hover or click to see details.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    sourceType: {
      control: "select",
      options: ["crm", "database", "api", "document"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof CitationTooltip>;

export const CRMSource: Story = {
  args: {
    citationId: "CRM-12345",
    sourceType: "crm",
    timestamp: new Date("2025-12-29"),
    verifiedBy: "IntegrityAgent-001",
  },
};

export const DatabaseSource: Story = {
  args: {
    citationId: "DB-67890",
    sourceType: "database",
    timestamp: new Date("2025-12-28"),
    verifiedBy: "IntegrityAgent-002",
  },
};

export const APISource: Story = {
  args: {
    citationId: "API-54321",
    sourceType: "api",
    timestamp: new Date("2025-12-27"),
    verifiedBy: "IntegrityAgent-003",
    metadata: {
      endpoint: "/api/v1/opportunities",
      method: "GET",
      status: 200,
    },
  },
};

export const DocumentSource: Story = {
  args: {
    citationId: "DOC-99999",
    sourceType: "document",
    timestamp: new Date("2025-12-26"),
    verifiedBy: "IntegrityAgent-004",
    metadata: {
      filename: "proposal.pdf",
      page: 5,
    },
  },
};

export const WithMetadata: Story = {
  args: {
    citationId: "CRM-SFDC-001",
    sourceType: "crm",
    timestamp: new Date(),
    verifiedBy: "IntegrityAgent-005",
    metadata: {
      opportunityId: "OP-123456",
      accountName: "Acme Corp",
      stage: "Closed Won",
      amount: 150000,
    },
  },
};

export const AllSourceTypes: Story = {
  render: () => (
    <div className="flex gap-3">
      <CitationTooltip citationId="CRM-001" sourceType="crm" />
      <CitationTooltip citationId="DB-002" sourceType="database" />
      <CitationTooltip citationId="API-003" sourceType="api" />
      <CitationTooltip citationId="DOC-004" sourceType="document" />
    </div>
  ),
};
