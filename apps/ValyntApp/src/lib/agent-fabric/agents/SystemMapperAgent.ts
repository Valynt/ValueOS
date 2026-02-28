import { v4 as uuidv4 } from "uuid";

import type { Entity, Relationship, SystemMap } from "./sof-types";

interface DiscoveryAnalysisResult {
  systemMap: SystemMap;
  entities: Entity[];
  relationships: Relationship[];
  leveragePoints: Array<{
    id: string;
    system_map_id: string;
    leverage_type: string;
    leverage_description: string;
    impact_potential: number;
    feasibility_score: number;
  }>;
}

export class SystemMapperAgent {
  async analyzeDiscoveryData(
    businessCaseId: string,
    discoveryData: Record<string, unknown> | null
  ): Promise<DiscoveryAnalysisResult> {
    if (!businessCaseId) {
      throw new Error("Business case ID is required");
    }

    if (!discoveryData) {
      throw new Error("Discovery data is required");
    }

    const systemMap: SystemMap = {
      id: `system-map-${uuidv4()}`,
      business_case_id: businessCaseId,
      map_name: String(discoveryData["problem_statement"] ?? "System Map"),
      map_description: String(discoveryData["desired_state"] ?? "Generated system map"),
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const stakeholders = Array.isArray(discoveryData["stakeholders"])
      ? (discoveryData["stakeholders"] as string[])
      : [];

    const entities = stakeholders.length
      ? stakeholders.map((stakeholder) => ({
          id: `entity-${uuidv4()}`,
          entity_type: "actor",
          entity_name: stakeholder,
          entity_description: `${stakeholder} stakeholder`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      : [
          {
            id: `entity-${uuidv4()}`,
            entity_type: "process",
            entity_name: "Core Process",
            entity_description: "Primary system process",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

    const relationships = entities.length > 1
      ? [
          {
            id: `rel-${uuidv4()}`,
            source_entity_id: entities[0].id,
            target_entity_id: entities[1].id,
            relationship_type: "depends_on",
            relationship_strength: 0.7,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      : [];

    const savedMap = await this.saveSystemMap(systemMap);
    const leveragePoints = await this.identifyLeveragePoints(savedMap, entities, relationships);

    return {
      systemMap: savedMap,
      entities,
      relationships,
      leveragePoints,
    };
  }

  async identifyLeveragePoints(
    systemMap: SystemMap,
    entities: Entity[],
    relationships: Relationship[]
  ): Promise<DiscoveryAnalysisResult["leveragePoints"]> {
    const leveragePoints = [
      {
        id: `lp-${uuidv4()}`,
        system_map_id: systemMap.id,
        leverage_type: relationships.length ? "information_flow" : "structure",
        leverage_description: "Optimize information pathways",
        impact_potential: 8,
        feasibility_score: 7,
      },
      {
        id: `lp-${uuidv4()}`,
        system_map_id: systemMap.id,
        leverage_type: entities.length > 2 ? "rules" : "feedback_loops",
        leverage_description: "Refine feedback mechanisms",
        impact_potential: 6,
        feasibility_score: 6,
      },
    ];

    return leveragePoints.sort((a, b) => b.impact_potential - a.impact_potential);
  }

  async updateSystemMap(systemMapId: string, updates: Partial<SystemMap>): Promise<SystemMap> {
    return {
      id: systemMapId,
      business_case_id: updates.business_case_id ?? "unknown",
      map_name: updates.map_name ?? "Updated Map",
      map_description: updates.map_description ?? "",
      status: updates.status ?? "draft",
      created_at: updates.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async addEntity(systemMapId: string, newEntity: Partial<Entity>): Promise<Entity> {
    return {
      id: newEntity.id ?? `entity-${uuidv4()}`,
      entity_type: newEntity.entity_type ?? "actor",
      entity_name: newEntity.entity_name ?? "New Entity",
      entity_description: newEntity.entity_description ?? "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      system_map_id: systemMapId,
    };
  }

  async addRelationship(
    systemMapId: string,
    newRelationship: Partial<Relationship>
  ): Promise<Relationship> {
    return {
      id: newRelationship.id ?? `rel-${uuidv4()}`,
      source_entity_id: newRelationship.source_entity_id ?? "unknown",
      target_entity_id: newRelationship.target_entity_id ?? "unknown",
      relationship_type: newRelationship.relationship_type ?? "influences",
      relationship_strength: newRelationship.relationship_strength ?? 0.5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      system_map_id: systemMapId,
    };
  }

  protected async saveSystemMap(systemMap: SystemMap): Promise<SystemMap> {
    return systemMap;
  }
}
