/**
 * VALYNT-Aligned shadcn/ui Component Examples
 * 
 * This component demonstrates proper usage of shadcn/ui components
 * with VALYNT design system integration.
 * 
 * VALYNT Design Principles:
 * - Dark-first: Dark backgrounds are default
 * - Semantic colors: Teal = value intelligence, Grey = structure
 * - 8px spacing grid: Use vc-1, vc-2, vc-3, etc.
 * - Elevation via surfaces: surface-1 (base), surface-2 (cards), surface-3 (modals)
 * 
 * Token Mapping:
 * - bg-primary → Value Teal (use for value-related actions)
 * - bg-secondary → Elevated surface (use for secondary actions)
 * - bg-muted → Graph Grey (use for metadata/structure)
 * - bg-card → Surface 2 (use for raised content)
 * - bg-popover → Surface 3 (use for overlays)
 */

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export function ShadcnExample() {
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Value Intelligence Updated",
      description: "Your settings have been saved successfully.",
    });
  };

  const handleValueAction = () => {
    toast({
      title: "Value Action Triggered",
      description: "This action represents value intelligence (Teal).",
    });
  };

  const handleStructureAction = () => {
    toast({
      title: "Structure Action Triggered",
      description: "This action represents metadata/structure (Grey).",
    });
  };

  return (
    <div className="min-h-screen bg-vc-surface-1 p-vc-6">
      <div className="container mx-auto space-y-vc-6">
        {/* Header */}
        <div className="space-y-vc-2">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            VALYNT Design System
          </h1>
          <p className="text-muted-foreground">
            shadcn/ui components integrated with VALYNT brand tokens
          </p>
        </div>

        {/* Surface Elevation Example */}
        <Card className="border-vc-border-default">
          <CardHeader>
            <CardTitle className="text-foreground">Surface Elevation</CardTitle>
            <CardDescription className="text-muted-foreground">
              Cards use surface-2 for raised content (bg-card)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-vc-4">
            <div className="p-vc-3 bg-vc-surface-3 rounded-vc-md border border-vc-border-default">
              <p className="text-sm text-foreground">
                This nested element uses surface-3 for highest elevation
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              VALYNT uses surface tokens for elevation, not shadows
            </p>
          </CardContent>
        </Card>

        {/* Form Example with VALYNT Semantics */}
        <Card className="border-vc-border-default">
          <CardHeader>
            <CardTitle className="text-foreground">Value Intelligence Settings</CardTitle>
            <CardDescription className="text-muted-foreground">
              Configure value tracking and economic intelligence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-vc-4">
              <div className="space-y-vc-2">
                <Label htmlFor="metric" className="text-foreground">
                  Metric Name
                </Label>
                <Input
                  id="metric"
                  placeholder="e.g., Revenue Impact"
                  className="bg-vc-surface-3 border-vc-border-default"
                />
              </div>

              <div className="space-y-vc-2">
                <Label htmlFor="category" className="text-foreground">
                  Category
                </Label>
                <Select>
                  <SelectTrigger
                    id="category"
                    className="bg-vc-surface-3 border-vc-border-default"
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-vc-surface-3 border-vc-border-default">
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="cost">Cost Reduction</SelectItem>
                    <SelectItem value="efficiency">Efficiency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-vc-2">
                <Button type="submit" className="bg-primary hover:bg-primary/90">
                  Save Value Settings
                </Button>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Dialog Example - Highest Elevation */}
        <Card className="border-vc-border-default">
          <CardHeader>
            <CardTitle className="text-foreground">Modal Dialogs</CardTitle>
            <CardDescription className="text-muted-foreground">
              Dialogs use surface-3 (bg-popover) for highest elevation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open Value Confirmation</Button>
              </DialogTrigger>
              <DialogContent className="bg-vc-surface-3 border-vc-border-strong">
                <DialogHeader>
                  <DialogTitle className="text-foreground">
                    Confirm Value Intelligence Update
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    This action will update the value intelligence model. This
                    operation represents economic truth (Teal).
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button onClick={handleValueAction}>Confirm Update</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Button Variants - VALYNT Semantics */}
        <Card className="border-vc-border-default">
          <CardHeader>
            <CardTitle className="text-foreground">Button Semantics</CardTitle>
            <CardDescription className="text-muted-foreground">
              Button variants mapped to VALYNT design principles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-vc-4">
            <div className="space-y-vc-2">
              <p className="text-sm font-medium text-foreground">
                Value Intelligence Actions (Teal)
              </p>
              <div className="flex flex-wrap gap-vc-2">
                <Button onClick={handleValueAction}>Primary Action</Button>
                <Button variant="outline" onClick={handleValueAction}>
                  Secondary Action
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use primary (Teal) for value-related actions: metrics, outcomes,
                economic intelligence
              </p>
            </div>

            <div className="space-y-vc-2">
              <p className="text-sm font-medium text-foreground">
                Structure Actions (Grey)
              </p>
              <div className="flex flex-wrap gap-vc-2">
                <Button variant="secondary" onClick={handleStructureAction}>
                  Metadata Action
                </Button>
                <Button variant="ghost" onClick={handleStructureAction}>
                  Ghost Action
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use secondary/ghost for structural actions: navigation, metadata,
                graph operations
              </p>
            </div>

            <div className="space-y-vc-2">
              <p className="text-sm font-medium text-foreground">
                Destructive Actions (Error Red)
              </p>
              <div className="flex flex-wrap gap-vc-2">
                <Button variant="destructive">Delete</Button>
                <Button variant="destructive" disabled>
                  Disabled
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use destructive for dangerous actions: delete, remove, reset
              </p>
            </div>

            <div className="space-y-vc-2">
              <p className="text-sm font-medium text-foreground">Link Variant</p>
              <div className="flex flex-wrap gap-vc-2">
                <Button variant="link">Navigation Link</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use link for inline navigation without button styling
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Design Principles Summary */}
        <Card className="border-vc-border-strong bg-vc-surface-2">
          <CardHeader>
            <CardTitle className="text-foreground">
              VALYNT Design Principles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-vc-3">
            <div className="space-y-vc-1">
              <h3 className="text-sm font-semibold text-vc-teal-500">
                🎯 Semantic Token Usage
              </h3>
              <p className="text-sm text-muted-foreground">
                Always use semantic tokens (bg-primary, bg-card) never raw values
                (#18C3A5, #0B0C0F)
              </p>
            </div>

            <div className="space-y-vc-1">
              <h3 className="text-sm font-semibold text-vc-teal-500">
                🌑 Dark-First Approach
              </h3>
              <p className="text-sm text-muted-foreground">
                Dark mode is the default. Light mode is secondary (if needed)
              </p>
            </div>

            <div className="space-y-vc-1">
              <h3 className="text-sm font-semibold text-vc-teal-500">
                📊 Color Semantics
              </h3>
              <p className="text-sm text-muted-foreground">
                Teal = Value Intelligence | Grey = Structure/Metadata | Red =
                Errors
              </p>
            </div>

            <div className="space-y-vc-1">
              <h3 className="text-sm font-semibold text-vc-teal-500">
                📐 8px Spacing Grid
              </h3>
              <p className="text-sm text-muted-foreground">
                Use vc-1 (8px), vc-2 (16px), vc-3 (24px), vc-4 (32px), etc.
              </p>
            </div>

            <div className="space-y-vc-1">
              <h3 className="text-sm font-semibold text-vc-teal-500">
                🏗️ Surface Elevation
              </h3>
              <p className="text-sm text-muted-foreground">
                surface-1 (base) → surface-2 (cards) → surface-3 (modals). No
                shadows.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
