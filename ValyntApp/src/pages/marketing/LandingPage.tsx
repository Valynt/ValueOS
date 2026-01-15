import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="container mx-auto px-4 py-24">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Build something amazing
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          The modern platform for teams who want to ship faster and build better
          products.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/signup"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90"
          >
            Get Started Free
          </Link>
          <Link
            to="/docs"
            className="border px-6 py-3 rounded-md font-medium hover:bg-muted"
          >
            Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}
