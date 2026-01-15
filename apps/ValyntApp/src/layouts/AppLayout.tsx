import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@app/providers/AuthProvider";

export function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-muted/30 p-4">
        <div className="text-xl font-bold mb-8">Valynt</div>
        <nav className="space-y-2">
          <Link
            to="/dashboard"
            className="block px-3 py-2 rounded-md hover:bg-muted text-sm"
          >
            Dashboard
          </Link>
          <Link
            to="/settings"
            className="block px-3 py-2 rounded-md hover:bg-muted text-sm"
          >
            Settings
          </Link>
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b flex items-center justify-end px-6 gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
