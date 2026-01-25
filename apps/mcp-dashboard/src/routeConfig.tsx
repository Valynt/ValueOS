import React from "react";
import Dashboard from "./pages/Dashboard";
import CompanySearch from "./pages/CompanySearch";
import CompanyDetails from "./pages/CompanyDetails";
import SentimentAnalysis from "./pages/SentimentAnalysis";
import Forecasting from "./pages/Forecasting";
import APIManagement from "./pages/APIManagement";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/Login";

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
