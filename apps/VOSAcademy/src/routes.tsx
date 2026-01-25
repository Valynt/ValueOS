import React from "react";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import PillarOverview from "@/pages/PillarOverview";
import Quiz from "@/pages/Quiz";
import AITutor from "@/pages/AITutor";
import Profile from "@/pages/Profile";
import Resources from "@/pages/Resources";
import Certifications from "@/pages/Certifications";
import { Simulations } from "@/pages/Simulations";
import { SimulationProgress } from "@/pages/SimulationProgress";
import Analytics from "@/pages/Analytics";
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
