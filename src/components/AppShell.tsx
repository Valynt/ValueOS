// /workspaces/ValueOS/src/components/AppShell.tsx
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import {
  Search,
  Home,
  Briefcase,
  Library,
  BarChart3,
  Settings,
  Users,
  FileText,
  Target,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/deals", label: "Deals", icon: Briefcase },
  { to: "/drivers", label: "Value Drivers", icon: Library },
  { to: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/insights", label: "Insights", icon: Target },
  { to: "/admin", label: "Admin", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

const AppShell: React.FC = () => {
  const location = useLocation();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const breadcrumbs = location.pathname
    .split("/")
    .filter(Boolean)
    .map((crumb, i, arr) => ({
      label: crumb.charAt(0).toUpperCase() + crumb.slice(1),
      to: "/" + arr.slice(0, i + 1).join("/"),
    }));

  return (
    <div className="flex h-screen bg-gray-100">
      <nav className="w-64 bg-white shadow-md">
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-800">ValueOS</h1>
        </div>
        <ul className="space-y-2 p-4">
          {navItems.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex items-center p-2 rounded hover:bg-gray-200 ${location.pathname === item.to ? "bg-gray-300" : ""}`}
              >
                <item.icon className="w-5 h-5 mr-2" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2 text-sm text-gray-600">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span>/</span>}
                  <Link to={crumb.to} className="hover:underline">
                    {crumb.label}
                  </Link>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search... (/)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
