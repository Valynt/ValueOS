import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <p className="text-7xl font-extrabold tracking-tighter text-primary/20">404</p>
        <h2 className="text-xl font-semibold mt-4">Page Not Found</h2>
        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button onClick={() => setLocation("/")} className="mt-6 gap-2">
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
