import { MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';

import { useAppendWorkflowHandoffAddendum, useWorkflowHandoffCards } from '../hooks/useWorkflowHandoffCards';

interface HandoffTimelineCardsProps {
  runId: string | null;
  stageId: string;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
}

export function HandoffTimelineCards({ runId, stageId }: HandoffTimelineCardsProps) {
  const { data: cards = [], isLoading } = useWorkflowHandoffCards(runId, stageId);
  const appendAddendum = useAppendWorkflowHandoffAddendum(runId, stageId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!runId) return null;
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading handoff timeline…</div>;
  if (cards.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Handoff timeline">
      <h3 className="text-sm font-semibold tracking-wide text-foreground">Transition Handoff Timeline</h3>
      <p className="mt-1 text-xs text-muted-foreground">Immutable transition snapshots with append-only addendum comments.</p>

      <div className="mt-4 space-y-3">
        {cards.map((entry) => {
          const draft = drafts[entry.eventId] ?? '';

          return (
            <article key={entry.eventId} className="rounded-lg border border-border/70 bg-background/70 p-3">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {entry.card.transition.from_stage} → {entry.card.transition.to_stage}
                </p>
                <span className="text-xs text-muted-foreground">{formatTimestamp(entry.card.transition.timestamp)}</span>
              </header>

              <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
                <div><dt className="font-medium text-foreground inline">Objective:</dt> <dd className="inline">{entry.card.objective}</dd></div>
                <div><dt className="font-medium text-foreground inline">Expected outcome:</dt> <dd className="inline">{entry.card.expected_outcome}</dd></div>
                <div><dt className="font-medium text-foreground inline">Next owner:</dt> <dd className="inline">{entry.card.next_owner}</dd></div>
                <div><dt className="font-medium text-foreground inline">Confidence:</dt> <dd className="inline">{entry.card.confidence_summary.label} ({entry.card.confidence_summary.score ?? 'n/a'})</dd></div>
              </dl>

              {entry.addenda.length > 0 ? (
                <ul className="mt-3 space-y-1 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  {entry.addenda.map((addendum, index) => (
                    <li key={`${entry.eventId}-addendum-${index}`}>
                      <span className="font-medium text-foreground">{addendum.actor_id || 'user'}:</span> {addendum.comment}
                    </li>
                  ))}
                </ul>
              ) : null}

              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draft.trim()) return;
                  appendAddendum.mutate(
                    { eventId: entry.eventId, comment: draft.trim() },
                    {
                      onSuccess: () => {
                        setDrafts((current) => ({ ...current, [entry.eventId]: '' }));
                      },
                    },
                  );
                }}
              >
                <label htmlFor={`handoff-addendum-${entry.eventId}`} className="text-xs font-medium text-foreground">Add addendum comment</label>
                <textarea
                  id={`handoff-addendum-${entry.eventId}`}
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  value={draft}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDrafts((current) => ({ ...current, [entry.eventId]: nextValue }));
                  }}
                />
                <button
                  type="submit"
                  className="inline-flex w-fit items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={appendAddendum.isPending || !draft.trim()}
                >
                  <MessageSquarePlus className="h-3 w-3" />
                  Append comment
                </button>
              </form>
            </article>
          );
        })}
      </div>
    </section>
  );
}
