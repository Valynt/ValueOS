/**
 * useActivities Hook - Fetch and manage activity feed data
 */

import { Activity } from '../types/ui.types';

// Fixed timestamp for deterministic mock data
const MOCK_TIMESTAMP = '2024-01-15T00:00:00.000Z';

const MOCK_ACTIVITIES: Activity[] = [
  {
    id: '1',
    type: 'recalculated',
    description: 'Value tree recalculated after DSO input change',
    actor: 'Alice Chen',
    timestamp: MOCK_TIMESTAMP,
  },
  {
    id: '2',
    type: 'evidence_attached',
    description: 'Attached 10-K filing to Current DSO node',
    actor: 'Bob Smith',
    timestamp: '2024-01-14T22:00:00.000Z',
  },
];

interface UseActivitiesResult {
  activities: Activity[];
  isLoading: boolean;
}

export function useActivities(): UseActivitiesResult {
  // In production, this would fetch from an API
  return {
    activities: MOCK_ACTIVITIES,
    isLoading: false,
  };
}
