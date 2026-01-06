/**
 * Font Loading Test Component
 * 
 * Verifies that Inter and JetBrains Mono fonts are loaded correctly
 * via @fontsource packages.
 */

export function FontTest() {
  return (
    <div className="min-h-screen bg-vc-surface-1 p-vc-6">
      <div className="container mx-auto space-y-vc-6">
        {/* Header */}
        <div className="space-y-vc-2">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            VALYNT Typography Test
          </h1>
          <p className="text-muted-foreground">
            Verifying Inter and JetBrains Mono font loading
          </p>
        </div>

        {/* Inter Font Tests */}
        <div className="bg-vc-surface-2 border border-vc-border-default rounded-vc-md p-vc-4 space-y-vc-3">
          <h2 className="text-3xl font-bold text-foreground">
            Inter Font Family
          </h2>
          <p className="text-muted-foreground">
            UI and content font - should render as Inter
          </p>

          <div className="space-y-vc-2">
            <div className="space-y-vc-1">
              <p className="text-xs text-muted-foreground">Font Weight: 400 (Regular)</p>
              <p className="text-base font-normal text-foreground">
                The quick brown fox jumps over the lazy dog. 0123456789
              </p>
            </div>

            <div className="space-y-vc-1">
              <p className="text-xs text-muted-foreground">Font Weight: 500 (Medium)</p>
              <p className="text-base font-medium text-foreground">
                The quick brown fox jumps over the lazy dog. 0123456789
              </p>
            </div>

            <div className="space-y-vc-1">
              <p className="text-xs text-muted-foreground">Font Weight: 600 (Semibold)</p>
              <p className="text-base font-semibold text-foreground">
                The quick brown fox jumps over the lazy dog. 0123456789
              </p>
            </div>

            <div className="space-y-vc-1">
              <p className="text-xs text-muted-foreground">Font Weight: 700 (Bold)</p>
              <p className="text-base font-bold text-foreground">
                The quick brown fox jumps over the lazy dog. 0123456789
              </p>
            </div>
          </div>

          <div className="space-y-vc-2 pt-vc-3 border-t border-vc-border-default">
            <p className="text-xs text-muted-foreground">Font Sizes</p>
            <p className="text-xs text-foreground">Extra Small (12px)</p>
            <p className="text-sm text-foreground">Small (14px)</p>
            <p className="text-base text-foreground">Base (16px)</p>
            <p className="text-3xl text-foreground">3XL (30px)</p>
            <p className="text-5xl text-foreground">5XL (48px)</p>
          </div>
        </div>

        {/* JetBrains Mono Font Tests */}
        <div className="bg-vc-surface-2 border border-vc-border-default rounded-vc-md p-vc-4 space-y-vc-3">
          <h2 className="text-3xl font-bold text-foreground">
            JetBrains Mono Font Family
          </h2>
          <p className="text-muted-foreground">
            Code and data font - should render as JetBrains Mono
          </p>

          <div className="space-y-vc-2">
            <div className="space-y-vc-1">
              <p className="text-xs text-muted-foreground">Font Weight: 400 (Regular)</p>
              <code className="block text-base font-mono font-normal text-foreground bg-vc-surface-3 p-vc-2 rounded">
                const value = calculateROI(revenue, cost);
              </code>
            </div>

            <div className="space-y-vc-1">
              <p className="text-xs text-muted-foreground">Font Weight: 500 (Medium)</p>
              <code className="block text-base font-mono font-medium text-foreground bg-vc-surface-3 p-vc-2 rounded">
                function analyzeValue(data: MetricData) {"{"}
              </code>
            </div>

            <div className="space-y-vc-1">
              <p className="text-xs text-muted-foreground">Font Weight: 600 (Semibold)</p>
              <code className="block text-base font-mono font-semibold text-foreground bg-vc-surface-3 p-vc-2 rounded">
                // VALYNT Value Intelligence System
              </code>
            </div>
          </div>

          <div className="space-y-vc-2 pt-vc-3 border-t border-vc-border-default">
            <p className="text-xs text-muted-foreground">Code Example</p>
            <pre className="font-mono text-sm text-foreground bg-vc-surface-3 p-vc-3 rounded overflow-x-auto">
{`interface ValueMetric {
  id: string;
  name: string;
  value: number;
  unit: "USD" | "percentage";
  confidence: number;
}

const metric: ValueMetric = {
  id: "rev-001",
  name: "Revenue Impact",
  value: 50000,
  unit: "USD",
  confidence: 0.95
};`}
            </pre>
          </div>
        </div>

        {/* Font Loading Status */}
        <div className="bg-vc-surface-2 border border-vc-border-strong rounded-vc-md p-vc-4">
          <h3 className="text-xl font-semibold text-foreground mb-vc-2">
            Font Loading Status
          </h3>
          <div className="space-y-vc-1 text-sm">
            <p className="text-muted-foreground">
              ✅ Inter: Loaded via @fontsource/inter (weights: 400, 500, 600, 700)
            </p>
            <p className="text-muted-foreground">
              ✅ JetBrains Mono: Loaded via @fontsource/jetbrains-mono (weights: 400, 500, 600)
            </p>
            <p className="text-muted-foreground">
              ✅ Self-hosted: No external font CDN dependencies
            </p>
            <p className="text-muted-foreground">
              ✅ GDPR Compliant: All fonts served from same origin
            </p>
          </div>
        </div>

        {/* Browser Font Detection */}
        <div className="bg-vc-surface-2 border border-vc-border-default rounded-vc-md p-vc-4">
          <h3 className="text-xl font-semibold text-foreground mb-vc-2">
            Browser Font Detection
          </h3>
          <p className="text-sm text-muted-foreground mb-vc-3">
            Open browser DevTools → Network tab → Filter by "font" to verify font files are loading
          </p>
          <div className="space-y-vc-1 text-xs font-mono text-muted-foreground">
            <p>Expected files:</p>
            <p>• inter-latin-400-normal.woff2</p>
            <p>• inter-latin-500-normal.woff2</p>
            <p>• inter-latin-600-normal.woff2</p>
            <p>• inter-latin-700-normal.woff2</p>
            <p>• jetbrains-mono-latin-400-normal.woff2</p>
            <p>• jetbrains-mono-latin-500-normal.woff2</p>
            <p>• jetbrains-mono-latin-600-normal.woff2</p>
          </div>
        </div>
      </div>
    </div>
  );
}
