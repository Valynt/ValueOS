/**
 * LibraryPage - Central hub for all reusable assets
 * 
 * Templates, Value Drivers, and other strategic resources.
 */

import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Palette,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LIBRARY_SECTIONS = [
  {
    id: "templates",
    path: "/app/library/templates",
    icon: FileText,
    title: "Case Templates",
    description: "Pre-built value case structures for different scenarios",
    count: 6,
    color: "bg-blue-500",
  },
  {
    id: "drivers",
    path: "/app/library/drivers",
    icon: Target,
    title: "Value Drivers",
    description: "Strategic value propositions with formulas and narratives",
    count: 5,
    color: "bg-emerald-500",
  },
  {
    id: "branding",
    path: "/settings/branding",
    icon: Palette,
    title: "Brand Assets",
    description: "Logos, colors, fonts, and boilerplate for exports",
    count: null,
    color: "bg-purple-500",
  },
  {
    id: "playbooks",
    path: "/app/library/playbooks",
    icon: BookOpen,
    title: "Playbooks",
    description: "Sales plays and discovery guides",
    count: 3,
    color: "bg-amber-500",
    comingSoon: true,
  },
];

const LIBRARY_TABS = [
  { path: "templates", label: "Templates" },
  { path: "drivers", label: "Value Drivers" },
];

export function LibraryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we're on a sub-page
  const isSubPage = location.pathname !== "/app/library";

  if (isSubPage) {
    return (
      <div className="min-h-full bg-background">
        {/* Sub-navigation tabs */}
        <div className="border-b bg-white">
          <div className="max-w-7xl mx-auto px-8">
            <nav className="flex gap-1 -mb-px">
              {LIBRARY_TABS.map((tab) => (
                <NavLink
                  key={tab.path}
                  to={`/app/library/${tab.path}`}
                  className={({ isActive }) =>
                    cn(
                      "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
        <Outlet />
      </div>
    );
  }

  // Library Hub view
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Library</h1>
          <p className="text-slate-500 mt-1">
            Reusable assets for building compelling value cases
          </p>
        </div>
        <Button onClick={() => navigate("/app/library/drivers")}>
          <Plus className="h-4 w-4 mr-2" />
          New Value Driver
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">6</p>
                <p className="text-sm text-muted-foreground">Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">Value Drivers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">182</p>
                <p className="text-sm text-muted-foreground">Total Usage</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">74%</p>
                <p className="text-sm text-muted-foreground">Avg Win Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Cards */}
      <div className="grid grid-cols-2 gap-6">
        {LIBRARY_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card
              key={section.id}
              className={cn(
                "group cursor-pointer transition-all hover:shadow-md",
                section.comingSoon && "opacity-60"
              )}
              onClick={() => !section.comingSoon && navigate(section.path)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", section.color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{section.title}</h3>
                        {section.comingSoon && (
                          <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {section.description}
                      </p>
                      {section.count !== null && (
                        <p className="text-sm font-medium text-primary mt-2">
                          {section.count} items
                        </p>
                      )}
                    </div>
                  </div>
                  {!section.comingSoon && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Suggestions */}
      <Card className="mt-8 border-dashed bg-gradient-to-r from-primary/5 to-violet-500/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">AI-Powered Recommendations</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Get suggestions for new value drivers based on your won deals and industry trends
                </p>
              </div>
            </div>
            <Button>
              Generate Suggestions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LibraryPage;
