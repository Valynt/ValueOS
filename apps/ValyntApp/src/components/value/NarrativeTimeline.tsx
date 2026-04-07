/**
 * NarrativeTimeline — Horizontal version timeline component
 *
 * Phase 2: Narrative Mode
 */

interface Version {
  id: string;
  label: string;
  timestamp: string;
  isCurrent: boolean;
}

interface NarrativeTimelineProps {
  versions: Version[];
  onVersionSelect: (versionId: string) => void;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function NarrativeTimeline({
  versions,
  onVersionSelect,
}: NarrativeTimelineProps): JSX.Element {
  return (
    <div className="py-4">
      <div className="flex items-center">
        {versions.map((version, index) => (
          <div key={version.id} className="flex items-center">
            {/* Version point */}
            <button
              onClick={() => onVersionSelect(version.id)}
              className={`
                group flex flex-col items-center
                ${version.isCurrent ? "cursor-default" : "cursor-pointer"}
              `}
              aria-current={version.isCurrent ? "step" : undefined}
              data-current={version.isCurrent ? "true" : undefined}
            >
              <div
                className={`
                  flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium
                  ${
                    version.isCurrent
                      ? "bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-2"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  }
                `}
              >
                {index + 1}
              </div>
              <span
                className={`
                  mt-2 max-w-[120px] text-center text-xs
                  ${version.isCurrent ? "font-semibold text-blue-600" : "text-gray-600"}
                `}
              >
                {version.label}
              </span>
              <span className="mt-1 text-xs text-gray-400">{formatDate(version.timestamp)}</span>
            </button>

            {/* Connector line */}
            {index < versions.length - 1 && (
              <div className="mx-2 h-0.5 w-16 bg-gray-200" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default NarrativeTimeline;
