import { Outlet, Link } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
      <div className="mb-8">
        <Link to="/" className="text-2xl font-bold">
          Valynt
        </Link>
      </div>
      <div className="w-full max-w-md bg-card border rounded-lg p-8 shadow-sm">
        <Outlet />
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Valynt. All rights reserved.
      </p>
    </div>
  );
}
