/**
 * VALYNT Dialog Component Stories
 * 
 * Demonstrates shadcn/ui Dialog component with VALYNT design system.
 * 
 * Design Principles:
 * - Dialog uses surface-3 (highest elevation)
 * - Overlay uses proper opacity
 * - Follows 8px spacing grid
 * - Actions use semantic button variants
 */

import type { Meta, StoryObj } from "@storybook/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

const meta: Meta<typeof Dialog> = {
  title: "VALYNT/shadcn/Dialog",
  component: Dialog,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Dialog component with VALYNT design system integration. Uses surface-3 for highest elevation and semantic button variants.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Dialog>;

// Basic Dialog
export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            This is a basic dialog with VALYNT surface-3 background.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Dialog content goes here. This uses the highest elevation surface
            (surface-3) to appear above all other content.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// Confirmation Dialog
export const Confirmation: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Confirm Action</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Value Update</DialogTitle>
          <DialogDescription>
            Are you sure you want to update this value metric?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            This action will update the value intelligence model. The change will
            be reflected across all dashboards and reports.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// Destructive Dialog
export const Destructive: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Metric</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Delete Value Metric</DialogTitle>
              <DialogDescription>
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this metric? This will permanently
            remove the metric and all associated data from the system.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Delete Permanently</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// Form Dialog
export const FormDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create Metric</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Value Metric</DialogTitle>
          <DialogDescription>
            Add a new metric to track value intelligence
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Metric Name</Label>
            <Input id="name" placeholder="e.g., Revenue Impact" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Value (USD)</Label>
            <Input id="value" type="number" placeholder="50000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" placeholder="Brief description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Create Metric</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// Info Dialog
export const InfoDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Info className="mr-2 h-4 w-4" />
          Information
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-vc-teal-500/10 rounded-lg">
              <Info className="h-5 w-5 text-vc-teal-500" />
            </div>
            <div>
              <DialogTitle>Value Intelligence System</DialogTitle>
              <DialogDescription>
                How VALYNT tracks economic truth
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            VALYNT uses a sophisticated multi-agent system to analyze and track
            value metrics across your organization.
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Real-time value intelligence tracking</li>
            <li>Automated metric calculation and validation</li>
            <li>Cross-functional impact analysis</li>
            <li>Confidence scoring and uncertainty quantification</li>
          </ul>
        </div>
        <DialogFooter>
          <Button>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// Success Dialog
export const SuccessDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Complete Action</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-vc-teal-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-vc-teal-500" />
            </div>
            <div>
              <DialogTitle>Metric Created Successfully</DialogTitle>
              <DialogDescription>
                Your value metric has been added
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            The metric "Revenue Impact" has been successfully created and is now
            tracking value intelligence across your organization.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline">View Dashboard</Button>
          <Button>Create Another</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// Large Content Dialog
export const LargeContent: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">View Details</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Value Metric Details</DialogTitle>
          <DialogDescription>
            Comprehensive metric information and analysis
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Overview</h4>
            <p className="text-sm text-muted-foreground">
              This metric tracks the revenue impact of the new feature launch
              across all customer segments.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Key Metrics</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-vc-surface-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Value</p>
                <p className="text-lg font-bold text-vc-teal-500">$125,000</p>
              </div>
              <div className="p-3 bg-vc-surface-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className="text-lg font-bold text-foreground">95%</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Timeline</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Start Date</span>
                <span className="text-foreground">Jan 1, 2025</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">End Date</span>
                <span className="text-foreground">Dec 31, 2025</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="text-foreground">12 months</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              Impact Analysis
            </h4>
            <p className="text-sm text-muted-foreground">
              The feature has shown consistent growth across all segments, with
              enterprise customers showing the highest adoption rate at 78%.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Export Report</Button>
          <Button>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// VALYNT Surface Elevation Demo
export const SurfaceElevation: Story = {
  render: () => (
    <div className="space-y-4 p-6 bg-vc-surface-1 rounded-lg">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Dialog Surface Elevation
        </h3>
        <p className="text-xs text-muted-foreground">
          Dialogs use surface-3 (highest elevation) to appear above all content
        </p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button>Open to See Elevation</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Highest Elevation Surface</DialogTitle>
            <DialogDescription>
              This dialog uses surface-3 background
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              VALYNT uses surface tokens for elevation:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Surface 1: Base application shell</li>
              <li>Surface 2: Raised content (cards)</li>
              <li>Surface 3: Highest elevation (modals, dialogs)</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              No shadows are used - elevation is conveyed through surface colors.
            </p>
          </div>
          <DialogFooter>
            <Button>Understood</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  ),
};

// Multiple Actions
export const MultipleActions: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Multiple Actions</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose Action</DialogTitle>
          <DialogDescription>
            Select how you want to proceed with this metric
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            You can save this metric as a draft, publish it immediately, or
            schedule it for later.
          </p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="secondary" className="w-full sm:w-auto">
            Save as Draft
          </Button>
          <Button variant="outline" className="w-full sm:w-auto">
            Schedule
          </Button>
          <Button className="w-full sm:w-auto">Publish Now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
