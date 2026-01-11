/**
 * VALYNT Design System Showcase
 * 
 * Comprehensive demonstration of VALYNT design principles and shadcn/ui integration.
 * 
 * This story showcases:
 * - Color system (surfaces, accents, semantic colors)
 * - Typography (Inter, JetBrains Mono)
 * - Spacing (8px grid)
 * - Component integration
 * - Design principles
 */

import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./card";
import { Input } from "./input";
import { Label } from "./label";
import { TrendingUp, DollarSign, Activity, Users } from "lucide-react";

const meta: Meta = {
  title: "VALYNT/Design System",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Complete VALYNT design system showcase demonstrating color tokens, typography, spacing, and component integration.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

// Color System
export const ColorSystem: Story = {
  render: () => (
    <div className="min-h-screen bg-vc-surface-1 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            VALYNT Color System
          </h1>
          <p className="text-muted-foreground">
            Dark-first design with semantic color tokens
          </p>
        </div>

        {/* Surface Colors */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            Surface Hierarchy
          </h2>
          <p className="text-sm text-muted-foreground">
            Elevation is conveyed through surface tokens, not shadows
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-6 bg-vc-surface-1 border border-vc-border-default rounded-lg">
              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground">
                  --vc-surface-1
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Surface 1
                </div>
                <div className="text-xs text-muted-foreground">
                  Base application shell
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  #0B0C0F
                </div>
              </div>
            </div>

            <div className="p-6 bg-vc-surface-2 border border-vc-border-default rounded-lg">
              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground">
                  --vc-surface-2
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Surface 2
                </div>
                <div className="text-xs text-muted-foreground">
                  Raised content (cards)
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  #13141A
                </div>
              </div>
            </div>

            <div className="p-6 bg-vc-surface-3 border border-vc-border-default rounded-lg">
              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground">
                  --vc-surface-3
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Surface 3
                </div>
                <div className="text-xs text-muted-foreground">
                  Highest elevation (modals)
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  #1A1C24
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Colors */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            Brand Accent Colors
          </h2>
          <p className="text-sm text-muted-foreground">
            Semantic colors with specific meanings
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-vc-surface-2 border border-vc-border-default rounded-lg">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-vc-teal-500 rounded-lg"></div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Value Teal
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      --vc-accent-teal-500
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Represents value intelligence, economic truth, and primary actions
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  #18C3A5
                </div>
              </div>
            </div>

            <div className="p-6 bg-vc-surface-2 border border-vc-border-default rounded-lg">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-vc-grey-500 rounded-lg"></div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Graph Grey
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      --vc-accent-grey-500
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Represents structure, metadata, and neutral context
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  #5A5D67
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Border Colors */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Borders</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-vc-surface-2 border-2 border-vc-border-default rounded-lg">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground">
                  Default Border
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  --vc-border-default (#2A2A2A)
                </div>
              </div>
            </div>

            <div className="p-6 bg-vc-surface-2 border-2 border-vc-border-strong rounded-lg">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground">
                  Strong Border
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  --vc-border-strong (#3A3A3A)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

// Typography System
export const Typography: Story = {
  render: () => (
    <div className="min-h-screen bg-vc-surface-1 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            VALYNT Typography
          </h1>
          <p className="text-muted-foreground">
            Inter for UI/content, JetBrains Mono for code/data
          </p>
        </div>

        {/* Inter Font */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            Inter Font Family
          </h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Font Weight: 400</p>
                <p className="text-base font-normal text-foreground">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Font Weight: 500</p>
                <p className="text-base font-medium text-foreground">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Font Weight: 600</p>
                <p className="text-base font-semibold text-foreground">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Font Weight: 700</p>
                <p className="text-base font-bold text-foreground">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Font Sizes */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Font Scale</h2>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-xs text-foreground">Extra Small (12px)</p>
              <p className="text-sm text-foreground">Small (14px)</p>
              <p className="text-base text-foreground">Base (16px)</p>
              <p className="text-3xl text-foreground">3XL (30px)</p>
              <p className="text-5xl text-foreground">5XL (48px)</p>
            </CardContent>
          </Card>
        </div>

        {/* JetBrains Mono */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            JetBrains Mono (Code/Data)
          </h2>
          <Card>
            <CardContent className="pt-6">
              <pre className="font-mono text-sm text-foreground bg-vc-surface-3 p-4 rounded overflow-x-auto">
{`interface ValueMetric {
  id: string;
  name: string;
  value: number;
  unit: "USD" | "percentage";
  confidence: number;
}

const metric: ValueMetric = {
  id: "rev-001",
  name: "Revenue Impact",
  value: 50000,
  unit: "USD",
  confidence: 0.95
};`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  ),
};

// Spacing System
export const SpacingSystem: Story = {
  render: () => (
    <div className="min-h-screen bg-vc-surface-1 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            VALYNT Spacing System
          </h1>
          <p className="text-muted-foreground">8px base unit grid</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {[
              { name: "vc-1", value: "8px", class: "p-vc-1" },
              { name: "vc-2", value: "16px", class: "p-vc-2" },
              { name: "vc-3", value: "24px", class: "p-vc-3" },
              { name: "vc-4", value: "32px", class: "p-vc-4" },
              { name: "vc-6", value: "48px", class: "p-vc-6" },
              { name: "vc-8", value: "64px", class: "p-vc-8" },
            ].map((spacing) => (
              <div key={spacing.name} className="space-y-2">
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-mono text-muted-foreground">
                    {spacing.name}
                  </div>
                  <div className="w-16 text-sm text-muted-foreground">
                    {spacing.value}
                  </div>
                  <div className="flex-1">
                    <div className="bg-vc-surface-3 border border-vc-border-default rounded">
                      <div className={`bg-vc-teal-500/20 ${spacing.class}`}>
                        <div className="h-4"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  ),
};

// Component Integration
export const ComponentIntegration: Story = {
  render: () => (
    <div className="min-h-screen bg-vc-surface-1 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Component Integration
          </h1>
          <p className="text-muted-foreground">
            shadcn/ui components with VALYNT theming
          </p>
        </div>

        {/* Dashboard Example */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-vc-teal-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">$45,231</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 mr-1 text-vc-teal-500" />
                +20.1% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-vc-teal-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">+2,350</div>
              <p className="text-xs text-muted-foreground">
                +180.1% from last month
              </p>
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

        {/* Form Example */}
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Create Value Metric</CardTitle>
            <CardDescription>
              Add a new metric to track value intelligence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="metric-name">Metric Name</Label>
              <Input id="metric-name" placeholder="e.g., Revenue Impact" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metric-value">Value (USD)</Label>
              <Input id="metric-value" type="number" placeholder="50000" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Cancel</Button>
              <Button>Create Metric</Button>
            </div>
          </CardContent>
        </Card>

        {/* Button Variants */}
        <Card>
          <CardHeader>
            <CardTitle>Button Semantics</CardTitle>
            <CardDescription>
              Buttons mapped to VALYNT design principles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Value Intelligence (Teal)
              </p>
              <div className="flex gap-2">
                <Button>Primary Action</Button>
                <Button variant="outline">Secondary Action</Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Structure (Grey)
              </p>
              <div className="flex gap-2">
                <Button variant="secondary">Metadata</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Destructive (Error Red)
              </p>
              <div className="flex gap-2">
                <Button variant="destructive">Delete</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
};

// Design Principles
export const DesignPrinciples: Story = {
  render: () => (
    <div className="min-h-screen bg-vc-surface-1 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            VALYNT Design Principles
          </h1>
          <p className="text-muted-foreground">
            Core principles guiding the design system
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              title: "Dark-First Approach",
              description:
                "Dark mode is the default, not an alternative. Light mode is secondary.",
            },
            {
              title: "Semantic Token Usage",
              description:
                "Always use semantic tokens (bg-primary, bg-card) never raw values (#18C3A5, #0B0C0F).",
            },
            {
              title: "Color Semantics",
              description:
                "Teal = Value Intelligence | Grey = Structure/Metadata | Red = Errors",
            },
            {
              title: "8px Spacing Grid",
              description:
                "All spacing aligns to 8px base unit (vc-1, vc-2, vc-3, etc.)",
            },
            {
              title: "Surface Elevation",
              description:
                "Elevation conveyed through surface tokens (surface-1 → surface-2 → surface-3), not shadows.",
            },
            {
              title: "Typography Hierarchy",
              description:
                "Inter for UI/content, JetBrains Mono for code/data. Fixed font scale.",
            },
            {
              title: "Value Intelligence Focus",
              description:
                "Teal color represents value and economic truth. Use only for value-related actions.",
            },
            {
              title: "Accessibility First",
              description:
                "Focus rings use Value Teal. All interactions have clear visual feedback.",
            },
          ].map((principle, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">{principle.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {principle.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  ),
};
