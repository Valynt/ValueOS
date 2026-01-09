/**
 * VALYNT Card Component Stories
 * 
 * Demonstrates shadcn/ui Card component with VALYNT design system integration.
 * 
 * Design Principles:
 * - Cards use surface-2 (raised content)
 * - Elevation via surface tokens, not shadows
 * - Border uses --vc-border-default
 * - Content uses proper spacing (8px grid)
 */

import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Button } from "./button";
import { Activity, DollarSign, TrendingUp, Users } from "lucide-react";

const meta: Meta<typeof Card> = {
  title: "VALYNT/shadcn/Card",
  component: Card,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Card component with VALYNT design system integration. Uses surface-2 for raised content and follows 8px spacing grid.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Card>;

// Basic Card
export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Value Metric</CardTitle>
        <CardDescription>Track economic intelligence</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This card displays value intelligence data using VALYNT surface-2
          background.
        </p>
      </CardContent>
    </Card>
  ),
};

// Card with Footer
export const WithFooter: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Revenue Impact</CardTitle>
        <CardDescription>Q4 2025 Performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-vc-teal-500">$125,000</div>
        <p className="text-xs text-muted-foreground mt-2">
          +15% from previous quarter
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm">
          Details
        </Button>
        <Button size="sm">Analyze</Button>
      </CardFooter>
    </Card>
  ),
};

// Metric Card
export const MetricCard: Story = {
  render: () => (
    <Card className="w-[300px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
        <DollarSign className="h-4 w-4 text-vc-teal-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">$45,231.89</div>
        <p className="text-xs text-muted-foreground">
          <TrendingUp className="inline h-3 w-3 mr-1 text-vc-teal-500" />
          +20.1% from last month
        </p>
      </CardContent>
    </Card>
  ),
};

// Interactive Card
export const Interactive: Story = {
  render: () => (
    <Card className="w-[350px] cursor-pointer hover:border-vc-border-strong transition-colors">
      <CardHeader>
        <CardTitle>Clickable Card</CardTitle>
        <CardDescription>Hover to see border change</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This card demonstrates interactive states using VALYNT border tokens.
        </p>
      </CardContent>
    </Card>
  ),
};

// Card with Icon
export const WithIcon: Story = {
  render: () => (
    <Card className="w-[300px]">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-vc-surface-3 rounded-lg">
            <Activity className="h-6 w-6 text-vc-teal-500" />
          </div>
          <div>
            <CardTitle>System Activity</CardTitle>
            <CardDescription>Real-time monitoring</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Active Users</span>
            <span className="font-medium text-foreground">1,234</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">API Calls</span>
            <span className="font-medium text-foreground">45,678</span>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

// Nested Cards (Surface Elevation)
export const NestedCards: Story = {
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Value Intelligence Dashboard</CardTitle>
        <CardDescription>Surface elevation demonstration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-vc-surface-3 rounded-lg border border-vc-border-default">
          <h4 className="text-sm font-semibold text-foreground mb-2">
            Elevated Content
          </h4>
          <p className="text-xs text-muted-foreground">
            This uses surface-3 for highest elevation within the card.
          </p>
        </div>
        <div className="p-4 bg-vc-surface-3 rounded-lg border border-vc-border-default">
          <h4 className="text-sm font-semibold text-foreground mb-2">
            Another Section
          </h4>
          <p className="text-xs text-muted-foreground">
            Multiple elevated sections maintain visual hierarchy.
          </p>
        </div>
      </CardContent>
    </Card>
  ),
};

// Dashboard Grid
export const DashboardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 p-6 bg-vc-surface-1 rounded-lg">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-vc-teal-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">$45,231</div>
          <p className="text-xs text-muted-foreground">+20.1% from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Users</CardTitle>
          <Users className="h-4 w-4 text-vc-teal-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">+2,350</div>
          <p className="text-xs text-muted-foreground">+180.1% from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Activity</CardTitle>
          <Activity className="h-4 w-4 text-vc-teal-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">+12,234</div>
          <p className="text-xs text-muted-foreground">+19% from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Growth</CardTitle>
          <TrendingUp className="h-4 w-4 text-vc-teal-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">+573</div>
          <p className="text-xs text-muted-foreground">+201 since last hour</p>
        </CardContent>
      </Card>
    </div>
  ),
};

// Form Card
export const FormCard: Story = {
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Create Value Metric</CardTitle>
        <CardDescription>
          Add a new metric to track value intelligence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Metric Name
          </label>
          <input
            type="text"
            placeholder="e.g., Revenue Impact"
            className="w-full px-3 py-2 bg-vc-surface-3 border border-vc-border-default rounded-md text-foreground text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Value</label>
          <input
            type="number"
            placeholder="50000"
            className="w-full px-3 py-2 bg-vc-surface-3 border border-vc-border-default rounded-md text-foreground text-sm"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Create Metric</Button>
      </CardFooter>
    </Card>
  ),
};

// VALYNT Surface Elevation Demo
export const SurfaceElevation: Story = {
  render: () => (
    <div className="space-y-4 p-6 bg-vc-surface-1 rounded-lg w-[500px]">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          VALYNT Surface Elevation
        </h3>
        <p className="text-xs text-muted-foreground">
          Elevation is conveyed through surface tokens, not shadows
        </p>
      </div>

      <div className="space-y-3">
        <div className="p-4 bg-vc-surface-1 border border-vc-border-default rounded-lg">
          <p className="text-sm text-foreground">
            Surface 1 - Base application shell
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-foreground">
              Surface 2 - Raised content (Cards)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="p-4 bg-vc-surface-3 rounded-lg border border-vc-border-default">
              <p className="text-sm text-foreground">
                Surface 3 - Highest elevation (Modals, nested content)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
};
