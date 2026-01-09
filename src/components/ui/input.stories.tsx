/**
 * VALYNT Input & Label Component Stories
 * 
 * Demonstrates shadcn/ui Input and Label components with VALYNT design system.
 * 
 * Design Principles:
 * - Inputs use surface-3 background
 * - Borders use --vc-border-default
 * - Focus ring uses Value Teal (--vc-accent-teal-500)
 * - Labels use proper spacing (8px grid)
 */

import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";
import { DollarSign, Lock, Mail, Search } from "lucide-react";

const meta: Meta<typeof Input> = {
  title: "VALYNT/shadcn/Input",
  component: Input,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Input component with VALYNT design system integration. Uses surface-3 background and Value Teal focus ring.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search"],
    },
    disabled: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

// Basic Input
export const Default: Story = {
  args: {
    placeholder: "Enter value...",
  },
};

// With Label
export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="metric-name">Metric Name</Label>
      <Input id="metric-name" placeholder="e.g., Revenue Impact" />
    </div>
  ),
};

// Email Input
export const Email: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="email">Email Address</Label>
      <Input id="email" type="email" placeholder="user@example.com" />
    </div>
  ),
};

// Password Input
export const Password: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="password">Password</Label>
      <Input id="password" type="password" placeholder="••••••••" />
    </div>
  ),
};

// Number Input
export const Number: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="value">Value (USD)</Label>
      <Input id="value" type="number" placeholder="50000" />
    </div>
  ),
};

// Search Input
export const SearchInput: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="search">Search Metrics</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input id="search" className="pl-10" placeholder="Search..." />
      </div>
    </div>
  ),
};

// With Icon (Left)
export const WithIconLeft: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="email-icon">Email</Label>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input id="email-icon" className="pl-10" placeholder="user@example.com" />
      </div>
    </div>
  ),
};

// With Icon (Right)
export const WithIconRight: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="amount">Amount</Label>
      <div className="relative">
        <Input id="amount" className="pr-10" placeholder="0.00" />
        <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  ),
};

// Disabled State
export const Disabled: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="disabled">Disabled Input</Label>
      <Input id="disabled" disabled placeholder="Cannot edit" />
    </div>
  ),
};

// With Helper Text
export const WithHelperText: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="metric">Metric Value</Label>
      <Input id="metric" type="number" placeholder="50000" />
      <p className="text-xs text-muted-foreground">
        Enter the value in USD (e.g., 50000 for $50,000)
      </p>
    </div>
  ),
};

// With Error State
export const WithError: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Label htmlFor="error-input" className="text-destructive">
        Email Address
      </Label>
      <Input
        id="error-input"
        type="email"
        placeholder="user@example.com"
        className="border-destructive focus-visible:ring-destructive"
      />
      <p className="text-xs text-destructive">Please enter a valid email address</p>
    </div>
  ),
};

// Form Example
export const FormExample: Story = {
  render: () => (
    <div className="space-y-6 w-[400px] p-6 bg-vc-surface-2 rounded-lg border border-vc-border-default">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Create Value Metric
        </h3>
        <p className="text-sm text-muted-foreground">
          Add a new metric to track value intelligence
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="form-name">Metric Name</Label>
          <Input id="form-name" placeholder="e.g., Revenue Impact" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="form-value">Value (USD)</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="form-value"
              type="number"
              className="pl-10"
              placeholder="50000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="form-description">Description</Label>
          <Input
            id="form-description"
            placeholder="Brief description of the metric"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="form-confidence">Confidence Level (%)</Label>
          <Input
            id="form-confidence"
            type="number"
            placeholder="95"
            min="0"
            max="100"
          />
          <p className="text-xs text-muted-foreground">
            How confident are you in this value? (0-100)
          </p>
        </div>
      </div>
    </div>
  ),
};

// VALYNT Focus States
export const FocusStates: Story = {
  render: () => (
    <div className="space-y-6 w-[400px] p-6 bg-vc-surface-1 rounded-lg">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          VALYNT Focus Ring
        </h3>
        <p className="text-xs text-muted-foreground">
          Focus ring uses Value Teal (--vc-accent-teal-500) to indicate active state
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="focus-1">Click to focus</Label>
          <Input id="focus-1" placeholder="Focus ring appears in Value Teal" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="focus-2">Another input</Label>
          <Input id="focus-2" placeholder="Consistent focus styling" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="focus-3">With icon</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="focus-3"
              type="password"
              className="pl-10"
              placeholder="Focus ring works with icons"
            />
          </div>
        </div>
      </div>
    </div>
  ),
};

// All Input Types
export const AllTypes: Story = {
  render: () => (
    <div className="space-y-4 w-[400px] p-6 bg-vc-surface-1 rounded-lg">
      <div className="space-y-2">
        <Label htmlFor="type-text">Text</Label>
        <Input id="type-text" type="text" placeholder="Text input" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type-email">Email</Label>
        <Input id="type-email" type="email" placeholder="email@example.com" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type-password">Password</Label>
        <Input id="type-password" type="password" placeholder="••••••••" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type-number">Number</Label>
        <Input id="type-number" type="number" placeholder="123" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type-search">Search</Label>
        <Input id="type-search" type="search" placeholder="Search..." />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type-tel">Telephone</Label>
        <Input id="type-tel" type="tel" placeholder="+1 (555) 000-0000" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type-url">URL</Label>
        <Input id="type-url" type="url" placeholder="https://example.com" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type-date">Date</Label>
        <Input id="type-date" type="date" />
      </div>
    </div>
  ),
};
