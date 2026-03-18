/**
 * ActivityFeed Component - Chronological log of system activities
 */

import { Activity } from '../../types/ui.types';

interface ActivityFeedProps {
  activities?: Activity[];
}

export function ActivityFeed({ activities = [] }: ActivityFeedProps) {
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'recalculated':
        return '🔄';
      case 'evidence_attached':
        return '📎';
      case 'objection_generated':
        return '⚠️';
      case 'node_locked':
        return '🔒';
      case 'phase_transition':
        return '📊';
      default:
        return '📝';
    }
  };

  return (
    <div className="p-4">
      <h4 className="text-xs font-semibold text-neutral-500 uppercase mb-3">Activity Log</h4>

      {sortedActivities.length === 0 ? (
        <div className="text-sm text-neutral-500">No recent activity</div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {sortedActivities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <span className="text-lg">{getActivityIcon(activity.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-neutral-900">{activity.description}</div>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span>{activity.actor}</span>
                  <span>•</span>
                  <span>{new Date(activity.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
