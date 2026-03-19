import { v4 as uuidv4 } from "uuid";

import type {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  SecurityIncident,
  SecurityIncidentFilters,
} from "./AgentSecurityTypes.js";

export class SecurityIncidentService {
  private incidents: SecurityIncident[] = [];

  async createSecurityIncident(
    type: IncidentType,
    severity: IncidentSeverity,
    description: string,
    source: string,
    affectedResources: string[],
    context: Record<string, unknown> = {}
  ): Promise<SecurityIncident> {
    const now = Date.now();
    const incident: SecurityIncident = {
      id: uuidv4(),
      type,
      severity,
      status: "open",
      description,
      source,
      affectedResources,
      timeline: [
        {
          timestamp: now,
          type: "incident_created",
          description: "Security incident created",
          details: context,
        },
      ],
      mitigation: {
        immediate: [],
        shortTerm: [],
        longTerm: [],
        prevention: [],
      },
      reportedAt: now,
    };

    this.incidents.push(incident);
    return incident;
  }

  getSecurityIncidents(filters?: SecurityIncidentFilters): SecurityIncident[] {
    let incidents = [...this.incidents];

    if (filters?.type) {
      incidents = incidents.filter((incident) => incident.type === filters.type);
    }
    if (filters?.severity) {
      incidents = incidents.filter((incident) => incident.severity === filters.severity);
    }
    if (filters?.status) {
      incidents = incidents.filter((incident) => incident.status === filters.status);
    }
    if (filters?.timeRange) {
      incidents = incidents.filter(
        (incident) =>
          incident.reportedAt >= filters.timeRange!.start &&
          incident.reportedAt <= filters.timeRange!.end
      );
    }

    return incidents.sort((a, b) => b.reportedAt - a.reportedAt);
  }

  calculateIncidentRisk(severity: IncidentSeverity): number {
    switch (severity) {
      case "low":
        return 0.2;
      case "medium":
        return 0.4;
      case "high":
        return 0.7;
      case "critical":
        return 0.9;
    }
  }

  updateIncidentStatus(id: string, status: IncidentStatus): SecurityIncident | null {
    const incident = this.incidents.find((entry) => entry.id === id) ?? null;
    if (!incident) return null;
    incident.status = status;
    return incident;
  }
}
