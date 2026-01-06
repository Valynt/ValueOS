/**
 * VALYNT Select Component Stories
 * 
 * Demonstrates shadcn/ui Select component with VALYNT design system.
 * 
 * Design Principles:
 * - Select uses surface-3 background
 * - Dropdown uses surface-3 (highest elevation)
 * - Focus ring uses Value Teal
 * - Follows 8px spacing grid
 */

import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Label } from "./label";

const meta: Meta<typeof Select> = {
  title: "VALYNT/shadcn/Select",
  component: Select,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Select component with VALYNT design system integration. Uses surface-3 for dropdown and Value Teal focus ring.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Select>;

// Basic Select
export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
        <SelectItem value="option3">Option 3</SelectItem>
      </SelectContent>
    </Select>
  ),
};

// With Label
export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2 w-[280px]">
      <Label htmlFor="metric-type">Metric Type</Label>
      <Select>
        <SelectTrigger id="metric-type">
          <SelectValue placeholder="Select metric type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="revenue">Revenue</SelectItem>
          <SelectItem value="cost">Cost Reduction</SelectItem>
          <SelectItem value="efficiency">Efficiency</SelectItem>
          <SelectItem value="satisfaction">Customer Satisfaction</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

// Metric Categories
export const MetricCategories: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="category">Value Category</Label>
      <Select>
        <SelectTrigger id="category">
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="financial">💰 Financial Impact</SelectItem>
          <SelectItem value="operational">⚙️ Operational Efficiency</SelectItem>
          <SelectItem value="customer">👥 Customer Value</SelectItem>
          <SelectItem value="strategic">🎯 Strategic Alignment</SelectItem>
          <SelectItem value="risk">🛡️ Risk Mitigation</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

// Time Periods
export const TimePeriods: Story = {
  render: () => (
    <div className="space-y-2 w-[280px]">
      <Label htmlFor="period">Time Period</Label>
      <Select>
        <SelectTrigger id="period">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="q1-2025">Q1 2025</SelectItem>
          <SelectItem value="q2-2025">Q2 2025</SelectItem>
          <SelectItem value="q3-2025">Q3 2025</SelectItem>
          <SelectItem value="q4-2025">Q4 2025</SelectItem>
          <SelectItem value="fy-2025">FY 2025</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

// With Helper Text
export const WithHelperText: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="confidence">Confidence Level</Label>
      <Select>
        <SelectTrigger id="confidence">
          <SelectValue placeholder="Select confidence level" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="high">High (90-100%)</SelectItem>
          <SelectItem value="medium">Medium (70-89%)</SelectItem>
          <SelectItem value="low">Low (50-69%)</SelectItem>
          <SelectItem value="uncertain">Uncertain (&lt;50%)</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        How confident are you in this value estimate?
      </p>
    </div>
  ),
};

// Disabled State
export const Disabled: Story = {
  render: () => (
    <div className="space-y-2 w-[280px]">
      <Label htmlFor="disabled">Disabled Select</Label>
      <Select disabled>
        <SelectTrigger id="disabled">
          <SelectValue placeholder="Cannot select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

// Form Example
export const FormExample: Story = {
  render: () => (
    <div className="space-y-6 w-[400px] p-6 bg-vc-surface-2 rounded-lg border border-vc-border-default">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Value Metric Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure metric parameters
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="form-type">Metric Type</Label>
          <Select>
            <SelectTrigger id="form-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Revenue Impact</SelectItem>
              <SelectItem value="cost">Cost Reduction</SelectItem>
              <SelectItem value="efficiency">Efficiency Gain</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="form-unit">Unit</Label>
          <Select>
            <SelectTrigger id="form-unit">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usd">USD ($)</SelectItem>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="count">Count</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="form-period">Time Period</Label>
          <Select>
            <SelectTrigger id="form-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annually">Annually</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="form-confidence">Confidence</Label>
          <Select>
            <SelectTrigger id="form-confidence">
              <SelectValue placeholder="Select confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High (90-100%)</SelectItem>
              <SelectItem value="medium">Medium (70-89%)</SelectItem>
              <SelectItem value="low">Low (50-69%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  ),
};

// Multiple Selects
export const MultipleSelects: Story = {
  render: () => (
    <div className="space-y-4 w-[350px] p-6 bg-vc-surface-1 rounded-lg">
      <div className="space-y-2">
        <Label htmlFor="select-1">Primary Category</Label>
        <Select>
          <SelectTrigger id="select-1">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="financial">Financial</SelectItem>
            <SelectItem value="operational">Operational</SelectItem>
            <SelectItem value="strategic">Strategic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="select-2">Sub-Category</Label>
        <Select>
          <SelectTrigger id="select-2">
            <SelectValue placeholder="Select sub-category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="revenue">Revenue Growth</SelectItem>
            <SelectItem value="margin">Margin Improvement</SelectItem>
            <SelectItem value="cost">Cost Reduction</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="select-3">Impact Level</Label>
        <Select>
          <SelectTrigger id="select-3">
            <SelectValue placeholder="Select impact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  ),
};

// VALYNT Surface Elevation
export const SurfaceElevation: Story = {
  render: () => (
    <div className="space-y-4 w-[400px] p-6 bg-vc-surface-1 rounded-lg">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Dropdown Surface Elevation
        </h3>
        <p className="text-xs text-muted-foreground">
          Dropdown uses surface-3 (highest elevation) for proper visual hierarchy
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="elevation-demo">Open to see elevation</Label>
        <Select>
          <SelectTrigger id="elevation-demo">
            <SelectValue placeholder="Click to open dropdown" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">
              Dropdown uses surface-3 background
            </SelectItem>
            <SelectItem value="2">
              Appears above all other content
            </SelectItem>
            <SelectItem value="3">
              Maintains VALYNT visual hierarchy
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  ),
};

// Long List
export const LongList: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="long-list">Select Country</Label>
      <Select>
        <SelectTrigger id="long-list">
          <SelectValue placeholder="Select country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="us">United States</SelectItem>
          <SelectItem value="uk">United Kingdom</SelectItem>
          <SelectItem value="ca">Canada</SelectItem>
          <SelectItem value="au">Australia</SelectItem>
          <SelectItem value="de">Germany</SelectItem>
          <SelectItem value="fr">France</SelectItem>
          <SelectItem value="jp">Japan</SelectItem>
          <SelectItem value="cn">China</SelectItem>
          <SelectItem value="in">India</SelectItem>
          <SelectItem value="br">Brazil</SelectItem>
          <SelectItem value="mx">Mexico</SelectItem>
          <SelectItem value="es">Spain</SelectItem>
          <SelectItem value="it">Italy</SelectItem>
          <SelectItem value="nl">Netherlands</SelectItem>
          <SelectItem value="se">Sweden</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
