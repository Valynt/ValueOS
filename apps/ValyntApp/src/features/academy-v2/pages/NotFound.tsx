/**
 * Not Found Page
 */
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-8">
        This academy page could not be found.
      </p>
      <Link to="/academy">
        <Button>Back to Academy</Button>
      </Link>
    </div>
  );
}

export default NotFound;
