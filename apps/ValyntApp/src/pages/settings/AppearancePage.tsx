import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function AppearancePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="icon-md icon-accent" />
            Appearance
          </CardTitle>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-4">
              <label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer has-[:checked]:border-primary">
                <input type="radio" name="theme" value="light" className="sr-only" />
                <Sun className="icon-lg mb-2" />
                Light
              </label>
              <label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer has-[:checked]:border-primary">
                <input type="radio" name="theme" value="dark" className="sr-only" />
                <Moon className="icon-lg mb-2" />
                Dark
              </label>
              <label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer has-[:checked]:border-primary">
                <input type="radio" name="theme" value="system" defaultChecked className="sr-only" />
                <Monitor className="icon-lg mb-2" />
                System
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AppearancePage;
