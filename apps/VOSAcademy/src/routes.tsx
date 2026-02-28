import React from "react";

import AITutor from "@/pages/AITutor";
import Analytics from "@/pages/Analytics";
import Certifications from "@/pages/Certifications";
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import PillarOverview from "@/pages/PillarOverview";
import Profile from "@/pages/Profile";
import Quiz from "@/pages/Quiz";
import Resources from "@/pages/Resources";
import { SimulationProgress } from "@/pages/SimulationProgress";
import { Simulations } from "@/pages/Simulations";
import ValueTreeBuilder from "@/pages/ValueTreeBuilder";

export type RouteConfig = {
  path: string;
  component: React.ComponentType;
  requiredRole?: string;
};

export const publicRoutes: RouteConfig[] = [
  { path: "/", component: Home },
  { path: "/404", component: NotFound },
];

export const protectedRoutes: RouteConfig[] = [
  { path: "/dashboard", component: Dashboard },
  { path: "/pillar/:pillarNumber", component: PillarOverview },
  { path: "/quiz/:pillarNumber", component: Quiz },
  { path: "/ai-tutor", component: AITutor },
  { path: "/profile", component: Profile },
  { path: "/resources", component: Resources },
  { path: "/certifications", component: Certifications },
  { path: "/simulations", component: Simulations },
  { path: "/simulation-progress", component: SimulationProgress },
  { path: "/analytics", component: Analytics },
  { path: "/value-tree-builder", component: ValueTreeBuilder },
];

export const catchAllRoute = { component: NotFound };
