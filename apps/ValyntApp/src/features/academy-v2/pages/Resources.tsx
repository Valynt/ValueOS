/**
 * Resources Page
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Resources() {
  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Learning Resources</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>Resource {i}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Helpful resource for your VOS learning journey.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default Resources;
