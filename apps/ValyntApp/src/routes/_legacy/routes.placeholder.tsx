/**
 * @deprecated Not active. Not imported.
 * Placeholder routes preserved for reference only. Do not wire without security review.
 */
import React from "react";
import { Routes, Route } from "react-router-dom";

// Placeholder components, to be replaced with actual pages
const Home = () => <div>Home Dashboard</div>;
const Deals = () => <div>Deals List</div>;
const DealWorkspace = () => <div>Deal Workspace</div>;
const ValueDrivers = () => <div>Value Drivers</div>;
const Benchmarks = () => <div>Benchmarks</div>;
const Templates = () => <div>Templates</div>;
const Insights = () => <div>Insights</div>;
const Admin = () => <div>Admin</div>;
const Settings = () => <div>Settings</div>;

const PlaceholderRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/deals" element={<Deals />} />
      <Route path="/deals/:id/*" element={<DealWorkspace />} />
      <Route path="/drivers" element={<ValueDrivers />} />
      <Route path="/benchmarks" element={<Benchmarks />} />
      <Route path="/templates" element={<Templates />} />
      <Route path="/insights" element={<Insights />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
};

void PlaceholderRoutes;
