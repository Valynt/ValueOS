/**
 * RightInspector Component - Right sidebar with node details
 */

export function RightInspector() {
  return (
    <aside className="w-80 bg-white border-l border-neutral-200 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-neutral-900 mb-2">Inspector</h3>
        <p className="text-sm text-neutral-500">Select a node to view details</p>
      </div>
    </aside>
  );
}
