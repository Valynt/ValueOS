/**
 * Export Button Stories
 * Storybook documentation for Export Button component
 */

import type { Meta, StoryObj } from "@storybook/react";
import { ExportButton } from "../ExportButton";

const meta: Meta<typeof ExportButton> = {
  title: "Components/Export Button",
  component: ExportButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Reusable export button supporting PDF, PNG, and Excel formats with progress tracking.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "radio",
      options: ["default", "compact"],
    },
    formats: {
      control: "check",
      options: ["pdf", "png", "excel"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ExportButton>;

// Sample data for Excel export
const sampleData = [
  { name: "Trinity Dashboard", value: 1500000, roi: 250, category: "template" },
  { name: "Scenario Matrix", value: 2000000, roi: 300, category: "template" },
  { name: "Agent Monitor", value: 500000, roi: 180, category: "dashboard" },
];

export const Default: Story = {
  args: {
    filename: "dashboard-export",
    formats: ["pdf", "png", "excel"],
    data: sampleData,
  },
};

export const CompactVariant: Story = {
  args: {
    variant: "compact",
    filename: "export",
    formats: ["pdf", "png", "excel"],
    data: sampleData,
  },
};

export const PDFOnly: Story = {
  args: {
    filename: "report",
    formats: ["pdf"],
    elementId: "export-demo",
  },
  decorators: [
    (Story) => (
      <div>
        <div id="export-demo" className="p-8 bg-white border rounded">
          <h1 className="text-2xl font-bold mb-4">Sample Export Content</h1>
          <p>This content will be exported as PDF.</p>
        </div>
        <div className="mt-4">
          <Story />
        </div>
      </div>
    ),
  ],
};

export const ExcelOnly: Story = {
  args: {
    filename: "data-export",
    formats: ["excel"],
    data: sampleData,
  },
};

export const AllFormats: Story = {
  args: {
    filename: "complete-export",
    formats: ["pdf", "png", "excel"],
    elementId: "export-demo",
    data: sampleData,
  },
  decorators: [
    (Story) => (
      <div>
        <div
          id="export-demo"
          className="p-8 bg-gradient-to-r from-blue-50 to-purple-50 border rounded"
        >
          <h1 className="text-3xl font-bold mb-4">Dashboard Export Demo</h1>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Revenue</div>
              <div className="text-2xl font-bold">$1.2M</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Cost Savings</div>
              <div className="text-2xl font-bold">$800K</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">ROI</div>
              <div className="text-2xl font-bold">250%</div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Story />
        </div>
      </div>
    ),
  ],
};
