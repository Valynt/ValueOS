import React from "react";

import AdminPanel from "./pages/AdminPanel";
import APIManagement from "./pages/APIManagement";
import CompanyDetails from "./pages/CompanyDetails";
import CompanySearch from "./pages/CompanySearch";
import Dashboard from "./pages/Dashboard";
import Forecasting from "./pages/Forecasting";
import Login from "./pages/Login";
import SentimentAnalysis from "./pages/SentimentAnalysis";

export type RouteConfig = {
  path: string;
  element: React.ReactElement;
};

export const publicRoutes: RouteConfig[] = [
  { path: "/login", element: <Login /> },
];

export const protectedRoutes: RouteConfig[] = [
  { path: "dashboard", element: <Dashboard /> },
  { path: "companies", element: <CompanySearch /> },
  { path: "companies/:cik", element: <CompanyDetails /> },
  { path: "sentiment", element: <SentimentAnalysis /> },
  { path: "forecasting", element: <Forecasting /> },
  { path: "api-management", element: <APIManagement /> },
];

export const adminRoutes: RouteConfig[] = [
  { path: "admin", element: <AdminPanel /> },
];

export const catchAllRoute = { path: "*", redirectTo: "/dashboard" };
export const protectedIndexRedirect = "/dashboard";
