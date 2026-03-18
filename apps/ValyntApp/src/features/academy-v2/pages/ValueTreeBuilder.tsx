/**
 * Value Tree Builder Page
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ValueTreeBuilder() {
  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Value Tree Builder</h1>
      <Card>
        <CardHeader>
          <CardTitle>Build Your Value Tree</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Create and visualize value hierarchies for your opportunities.
          </p>
          <Button>Create New Tree</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default ValueTreeBuilder;
