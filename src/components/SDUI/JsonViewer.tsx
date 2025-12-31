interface JsonViewerProps {
  data: unknown;
  title?: string;
  collapsible?: boolean;
}

export function JsonViewer({ data, title }: JsonViewerProps) {
  return (
    <div className="bg-neutral-900/50 rounded-lg border border-white/10 p-4 overflow-auto">
      {title && (
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {title}
        </div>
      )}
      <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default JsonViewer;
