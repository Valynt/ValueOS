/**
 * SystemMapCanvas Component
 * 
 * Interactive canvas for visualizing system maps with entities, relationships,
 * leverage points, and constraints. Part of the SOF SDUI system.
 */

import React, { useRef, useEffect, useState } from 'react';
import type { SystemEntity, SystemRelationship, LeveragePoint, SystemConstraint } from '../../types/sof';

export interface SystemMapCanvasProps {
  entities: SystemEntity[];
  relationships: SystemRelationship[];
  leveragePoints?: LeveragePoint[];
  constraints?: SystemConstraint[];
  title?: string;
  description?: string;
  width?: number;
  height?: number;
  interactive?: boolean;
  onEntityClick?: (entity: SystemEntity) => void;
  onRelationshipClick?: (relationship: SystemRelationship) => void;
  onLeveragePointClick?: (leveragePoint: LeveragePoint) => void;
}

/**
 * SystemMapCanvas component
 */
export const SystemMapCanvas: React.FC<SystemMapCanvasProps> = ({
  entities,
  relationships,
  leveragePoints = [],
  constraints = [],
  title,
  description,
  width = 800,
  height = 600,
  interactive = true,
  onEntityClick,
  onRelationshipClick,
  onLeveragePointClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);

  // Layout entities if positions not provided
  useEffect(() => {
    layoutEntities(entities, width, height);
  }, [entities, width, height]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw relationships first (so they appear behind entities)
    drawRelationships(ctx, relationships, entities);

    // Draw entities
    drawEntities(ctx, entities, leveragePoints, selectedEntity, hoveredEntity);

    // Draw leverage point indicators
    drawLeverageIndicators(ctx, leveragePoints, entities);

    // Draw constraints
    drawConstraints(ctx, constraints);
  }, [entities, relationships, leveragePoints, constraints, selectedEntity, hoveredEntity, width, height]);

  // Handle canvas click
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if clicked on entity
    const clickedEntity = findEntityAtPoint(x, y, entities);
    if (clickedEntity) {
      setSelectedEntity(clickedEntity.id);
      onEntityClick?.(clickedEntity);
      return;
    }

    // Check if clicked on leverage point
    const clickedLeverage = findLeveragePointAtPoint(x, y, leveragePoints, entities);
    if (clickedLeverage) {
      onLeveragePointClick?.(clickedLeverage);
      return;
    }

    // Deselect if clicked on empty space
    setSelectedEntity(null);
  };

  // Handle canvas hover
  const handleCanvasHover = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const hoveredEntity = findEntityAtPoint(x, y, entities);
    setHoveredEntity(hoveredEntity?.id || null);

    // Change cursor
    canvas.style.cursor = hoveredEntity ? 'pointer' : 'default';
  };

  return (
    <div className="system-map-canvas-container">
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      {description && <p className="text-sm text-gray-600 mb-4">{description}</p>}

      <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasHover}
          className="block"
        />

        {/* Legend */}
        <div className="absolute top-4 right-4 bg-white bg-opacity-90 p-3 rounded shadow-sm text-xs">
          <div className="font-semibold mb-2">Legend</div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>Stakeholder</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span>Process</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full bg-purple-500"></div>
            <span>KPI</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-yellow-600"></div>
            <span>Leverage Point</span>
          </div>
        </div>

        {/* Entity info panel */}
        {selectedEntity && (
          <div className="absolute bottom-4 left-4 bg-white p-4 rounded shadow-lg max-w-xs">
            {(() => {
              const entity = entities.find((e) => e.id === selectedEntity);
              if (!entity) return null;

              const leverage = leveragePoints.find((lp) => lp.location === entity.id);

              return (
                <>
                  <div className="font-semibold text-sm mb-1">{entity.name}</div>
                  <div className="text-xs text-gray-600 mb-2">Type: {entity.type}</div>
                  {leverage && (
                    <div className="text-xs bg-yellow-50 p-2 rounded border border-yellow-200">
                      <div className="font-semibold text-yellow-800">Leverage Point</div>
                      <div className="text-yellow-700">Impact: {leverage.potential_impact}/10</div>
                      <div className="text-yellow-700">Effort: {leverage.effort}</div>
                    </div>
                  )}
                  {entity.attributes && (
                    <div className="mt-2 text-xs">
                      {Object.entries(entity.attributes).map(([key, value]) => (
                        <div key={key} className="text-gray-600">
                          {key}: {JSON.stringify(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-gray-600">Entities</div>
          <div className="text-2xl font-semibold">{entities.length}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-gray-600">Relationships</div>
          <div className="text-2xl font-semibold">{relationships.length}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-gray-600">Leverage Points</div>
          <div className="text-2xl font-semibold">{leveragePoints.length}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-gray-600">Constraints</div>
          <div className="text-2xl font-semibold">{constraints.length}</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Layout entities using force-directed algorithm (simplified)
 */
function layoutEntities(entities: SystemEntity[], width: number, height: number): void {
  const padding = 60;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  entities.forEach((entity, index) => {
    if (!entity.position) {
      // Simple circular layout
      const angle = (index / entities.length) * 2 * Math.PI;
      const radius = Math.min(usableWidth, usableHeight) / 2 - 40;
      entity.position = {
        x: padding + usableWidth / 2 + radius * Math.cos(angle),
        y: padding + usableHeight / 2 + radius * Math.sin(angle),
      };
    }
  });
}

/**
 * Draw relationships
 */
function drawRelationships(
  ctx: CanvasRenderingContext2D,
  relationships: SystemRelationship[],
  entities: SystemEntity[]
): void {
  relationships.forEach((rel) => {
    const fromEntity = entities.find((e) => e.id === rel.from);
    const toEntity = entities.find((e) => e.id === rel.to);

    if (!fromEntity?.position || !toEntity?.position) return;

    ctx.beginPath();
    ctx.moveTo(fromEntity.position.x, fromEntity.position.y);
    ctx.lineTo(toEntity.position.x, toEntity.position.y);

    // Style based on polarity
    if (rel.polarity === 'negative') {
      ctx.strokeStyle = '#ef4444';
      ctx.setLineDash([5, 5]);
    } else {
      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([]);
    }

    ctx.lineWidth = (rel.strength || 0.5) * 3;
    ctx.stroke();

    // Draw arrow
    drawArrow(ctx, fromEntity.position, toEntity.position);
  });

  ctx.setLineDash([]);
}

/**
 * Draw arrow
 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number }
): void {
  const headLength = 10;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  // Shorten line to not overlap with node
  const shortenedTo = {
    x: to.x - 25 * Math.cos(angle),
    y: to.y - 25 * Math.sin(angle),
  };

  ctx.beginPath();
  ctx.moveTo(shortenedTo.x, shortenedTo.y);
  ctx.lineTo(
    shortenedTo.x - headLength * Math.cos(angle - Math.PI / 6),
    shortenedTo.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(shortenedTo.x, shortenedTo.y);
  ctx.lineTo(
    shortenedTo.x - headLength * Math.cos(angle + Math.PI / 6),
    shortenedTo.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

/**
 * Draw entities
 */
function drawEntities(
  ctx: CanvasRenderingContext2D,
  entities: SystemEntity[],
  leveragePoints: LeveragePoint[],
  selectedEntity: string | null,
  hoveredEntity: string | null
): void {
  entities.forEach((entity) => {
    if (!entity.position) return;

    const isLeverage = leveragePoints.some((lp) => lp.location === entity.id);
    const isSelected = entity.id === selectedEntity;
    const isHovered = entity.id === hoveredEntity;

    // Draw node
    ctx.beginPath();
    ctx.arc(entity.position.x, entity.position.y, 20, 0, 2 * Math.PI);

    // Color by type
    const colors: Record<string, string> = {
      stakeholder: '#3b82f6',
      process: '#10b981',
      kpi: '#8b5cf6',
      default: '#6b7280',
    };
    ctx.fillStyle = colors[entity.type] || colors.default;
    ctx.fill();

    // Highlight if leverage point
    if (isLeverage) {
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Highlight if selected or hovered
    if (isSelected || isHovered) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw label
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entity.name.substring(0, 15), entity.position.x, entity.position.y + 35);
  });
}

/**
 * Draw leverage indicators
 */
function drawLeverageIndicators(
  ctx: CanvasRenderingContext2D,
  leveragePoints: LeveragePoint[],
  entities: SystemEntity[]
): void {
  leveragePoints.forEach((lp) => {
    const entity = entities.find((e) => e.id === lp.location);
    if (!entity?.position) return;

    // Draw impact level
    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${lp.potential_impact}`, entity.position.x, entity.position.y + 5);
  });
}

/**
 * Draw constraints
 */
function drawConstraints(ctx: CanvasRenderingContext2D, constraints: SystemConstraint[]): void {
  // Draw constraint indicators in corner
  constraints.forEach((constraint, index) => {
    const y = 20 + index * 25;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(10, y, 15, 15);
    ctx.fillStyle = '#1e293b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(constraint.type.substring(0, 20), 30, y + 12);
  });
}

/**
 * Find entity at point
 */
function findEntityAtPoint(
  x: number,
  y: number,
  entities: SystemEntity[]
): SystemEntity | null {
  for (const entity of entities) {
    if (!entity.position) continue;

    const distance = Math.sqrt(
      Math.pow(x - entity.position.x, 2) + Math.pow(y - entity.position.y, 2)
    );

    if (distance <= 20) {
      return entity;
    }
  }

  return null;
}

/**
 * Find leverage point at point
 */
function findLeveragePointAtPoint(
  x: number,
  y: number,
  leveragePoints: LeveragePoint[],
  entities: SystemEntity[]
): LeveragePoint | null {
  for (const lp of leveragePoints) {
    const entity = entities.find((e) => e.id === lp.location);
    if (!entity?.position) continue;

    const distance = Math.sqrt(
      Math.pow(x - entity.position.x, 2) + Math.pow(y - entity.position.y, 2)
    );

    if (distance <= 20) {
      return lp;
    }
  }

  return null;
}

export default SystemMapCanvas;
