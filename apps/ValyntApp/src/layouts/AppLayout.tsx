import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePersona, type Persona } from "../context/PersonaContext";

export function AppLayout() {
  const { user, logout } = useAuth();
  const { persona, setPersona } = usePersona();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-muted/30 p-4 flex flex-col">
        <div className="text-xl font-bold mb-8">Valynt</div>
        <nav className="space-y-2 flex-1">
          <Link to="/dashboard" className="block px-3 py-2 rounded-md hover:bg-muted text-sm">
            Dashboard
          </Link>
          {persona === "VE" && (
            <Link to="/discovery" className="block px-3 py-2 rounded-md hover:bg-muted text-sm">
              Discovery (VE)
            </Link>
          )}
          <Link to="/settings" className="block px-3 py-2 rounded-md hover:bg-muted text-sm">
            Settings
          </Link>
        </nav>

        <div className="mt-auto pt-4 border-t">
          <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
            Active Persona
          </label>
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value as Persona)}
            className="w-full text-sm bg-transparent border rounded p-1"
          >
            <option value="VE">Value Engineer</option>
            <option value="CFO">CFO</option>
            <option value="SalesRep">Sales Rep</option>
            <option value="CSM">Customer Success</option>
          </select>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${persona === "CFO" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                }`}
            >
              {persona} Mode
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
