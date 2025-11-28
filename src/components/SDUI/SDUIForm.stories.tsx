/**
 * SDUIForm Storybook Stories
 * Install @storybook/react to use these stories
 */

// @ts-ignore - Storybook types not installed
import type { Meta, StoryObj } from '@storybook/react';
import { SDUIForm } from './SDUIForm';

const meta: Meta<typeof SDUIForm> = {
  title: 'SDUI/SDUIForm',
  component: SDUIForm,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    onSubmit: { action: 'submitted' },
    onCancel: { action: 'cancelled' },
    onChange: { action: 'changed' },
  },
};

export default meta;
type Story = StoryObj<typeof SDUIForm>;

// Basic form
export const Basic: Story = {
  args: {
    id: 'basic-form',
    title: 'Contact Information',
    description: 'Please provide your contact details',
    fields: [
      { id: 'name', type: 'text', label: 'Full Name', placeholder: 'John Doe', validation: { required: true } },
      { id: 'email', type: 'email', label: 'Email Address', placeholder: 'john@example.com', validation: { required: true, email: true } },
      { id: 'phone', type: 'text', label: 'Phone Number', placeholder: '+1 (555) 123-4567' },
      { id: 'message', type: 'textarea', label: 'Message', placeholder: 'Tell us about your project...', validation: { maxLength: 500 } },
    ],
    submitLabel: 'Send Message',
    cancelLabel: 'Cancel',
  },
};

// With sections
export const WithSections: Story = {
  args: {
    id: 'sectioned-form',
    title: 'Value Case Configuration',
    sections: [
      {
        id: 'basics',
        title: 'Basic Information',
        description: 'Core details about the value case',
        fields: [
          { id: 'caseName', type: 'text', label: 'Case Name', validation: { required: true } },
          { id: 'customer', type: 'text', label: 'Customer', validation: { required: true } },
          { id: 'stage', type: 'select', label: 'Stage', options: [
            { value: 'opportunity', label: 'Opportunity' },
            { value: 'target', label: 'Target' },
            { value: 'realization', label: 'Realization' },
          ]},
        ],
      },
      {
        id: 'kpis',
        title: 'Key Performance Indicators',
        description: 'Define the metrics to track',
        collapsible: true,
        fields: [
          { id: 'primaryKpi', type: 'text', label: 'Primary KPI', validation: { required: true } },
          { id: 'baseline', type: 'number', label: 'Baseline Value', prefix: '$' },
          { id: 'target', type: 'number', label: 'Target Value', prefix: '$' },
        ],
      },
    ],
  },
};

// With AI suggestions
export const WithAISuggestions: Story = {
  args: {
    id: 'ai-form',
    title: 'ROI Calculator',
    agentName: 'Value Agent',
    fields: [
      {
        id: 'annualRevenue',
        type: 'currency',
        label: 'Annual Revenue',
        prefix: '$',
        aiSuggestion: {
          value: 2500000,
          confidence: 0.87,
          reasoning: 'Based on company size and industry benchmarks',
        },
      },
      {
        id: 'efficiency',
        type: 'percentage',
        label: 'Efficiency Improvement',
        suffix: '%',
        validation: { min: 0, max: 100 },
        aiSuggestion: {
          value: 15,
          confidence: 0.72,
          reasoning: 'Typical improvement for similar implementations',
        },
      },
      {
        id: 'timeframe',
        type: 'select',
        label: 'Implementation Timeframe',
        options: [
          { value: '3', label: '3 months' },
          { value: '6', label: '6 months' },
          { value: '12', label: '12 months' },
        ],
        aiSuggestion: {
          value: '6',
          confidence: 0.91,
          reasoning: 'Optimal balance of speed and thoroughness',
        },
      },
    ],
    submitLabel: 'Calculate ROI',
  },
};

// Loading state
export const Loading: Story = {
  args: {
    ...Basic.args,
    loading: true,
  },
};

// Disabled state
export const Disabled: Story = {
  args: {
    ...Basic.args,
    disabled: true,
  },
};

// With validation errors (simulated)
export const WithErrors: Story = {
  args: {
    id: 'error-form',
    title: 'Form with Errors',
    fields: [
      { id: 'required', type: 'text', label: 'Required Field', validation: { required: true } },
      { id: 'email', type: 'email', label: 'Invalid Email', defaultValue: 'not-an-email', validation: { email: true } },
      { id: 'short', type: 'text', label: 'Too Short', defaultValue: 'ab', validation: { minLength: 5 } },
    ],
  },
};

// Different field types showcase
export const AllFieldTypes: Story = {
  args: {
    id: 'all-fields',
    title: 'Field Types Showcase',
    description: 'Demonstrating all available field types',
    fields: [
      { id: 'text', type: 'text', label: 'Text Input', placeholder: 'Enter text...' },
      { id: 'email', type: 'email', label: 'Email Input', placeholder: 'email@example.com' },
      { id: 'number', type: 'number', label: 'Number Input', placeholder: '0' },
      { id: 'textarea', type: 'textarea', label: 'Textarea', placeholder: 'Long text...' },
      { id: 'select', type: 'select', label: 'Select', options: [
        { value: '1', label: 'Option 1' },
        { value: '2', label: 'Option 2' },
        { value: '3', label: 'Option 3' },
      ]},
      { id: 'checkbox', type: 'checkbox', label: 'Checkbox', placeholder: 'I agree to terms' },
      { id: 'slider', type: 'slider', label: 'Slider', validation: { min: 0, max: 100 }, defaultValue: 50 },
      { id: 'date', type: 'date', label: 'Date' },
    ],
  },
};
