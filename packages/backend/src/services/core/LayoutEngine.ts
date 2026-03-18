// Migrated from apps/ValyntApp/src/services/LayoutEngine.ts
// and packages/backend/src/services/LayoutEngine.ts (identical logic, import path differed).
// Canonical location: packages/core-services/src/LayoutEngine.ts

import type { CanvasComponent } from './CanvasTypes.js';

export type { CanvasComponent };

export interface LayoutSuggestion {
  componentId: string;
  suggestedPosition: { x: number; y: number };
  reason: string;
}

export interface AlignmentInfo {
  orientation: 'horizontal' | 'vertical';
  position: number;
  alignedComponents: string[];
}

class LayoutEngine {
  private readonly SNAP_THRESHOLD = 15;
  private readonly GRID_SIZE = 20;
  private readonly MIN_SPACING = 20;

  findAlignmentGuides(moving: CanvasComponent, others: CanvasComponent[]): AlignmentInfo[] {
    const guides: AlignmentInfo[] = [];
    const t = this.SNAP_THRESHOLD;

    const me = {
      left: moving.position.x,
      right: moving.position.x + moving.size.width,
      top: moving.position.y,
      bottom: moving.position.y + moving.size.height,
      centerX: moving.position.x + moving.size.width / 2,
      centerY: moving.position.y + moving.size.height / 2,
    };

    for (const other of others) {
      if (other.id === moving.id) continue;

      const o = {
        left: other.position.x,
        right: other.position.x + other.size.width,
        top: other.position.y,
        bottom: other.position.y + other.size.height,
        centerX: other.position.x + other.size.width / 2,
        centerY: other.position.y + other.size.height / 2,
      };

      if (Math.abs(me.left - o.left) < t) guides.push({ orientation: 'vertical', position: o.left, alignedComponents: [other.id] });
      if (Math.abs(me.right - o.right) < t) guides.push({ orientation: 'vertical', position: o.right, alignedComponents: [other.id] });
      if (Math.abs(me.centerX - o.centerX) < t) guides.push({ orientation: 'vertical', position: o.centerX, alignedComponents: [other.id] });
      if (Math.abs(me.top - o.top) < t) guides.push({ orientation: 'horizontal', position: o.top, alignedComponents: [other.id] });
      if (Math.abs(me.bottom - o.bottom) < t) guides.push({ orientation: 'horizontal', position: o.bottom, alignedComponents: [other.id] });
      if (Math.abs(me.centerY - o.centerY) < t) guides.push({ orientation: 'horizontal', position: o.centerY, alignedComponents: [other.id] });
    }

    return guides;
  }

  snapToGrid(position: { x: number; y: number }): { x: number; y: number } {
    return {
      x: Math.round(position.x / this.GRID_SIZE) * this.GRID_SIZE,
      y: Math.round(position.y / this.GRID_SIZE) * this.GRID_SIZE,
    };
  }

  snapToAlignment(
    position: { x: number; y: number },
    size: { width: number; height: number },
    guides: AlignmentInfo[]
  ): { x: number; y: number } {
    let x = position.x;
    let y = position.y;

    for (const guide of guides) {
      if (guide.orientation === 'vertical') {
        if (Math.abs(x - guide.position) < this.SNAP_THRESHOLD) x = guide.position;
        else if (Math.abs(x + size.width / 2 - guide.position) < this.SNAP_THRESHOLD) x = guide.position - size.width / 2;
        else if (Math.abs(x + size.width - guide.position) < this.SNAP_THRESHOLD) x = guide.position - size.width;
      } else {
        if (Math.abs(y - guide.position) < this.SNAP_THRESHOLD) y = guide.position;
        else if (Math.abs(y + size.height / 2 - guide.position) < this.SNAP_THRESHOLD) y = guide.position - size.height / 2;
        else if (Math.abs(y + size.height - guide.position) < this.SNAP_THRESHOLD) y = guide.position - size.height;
      }
    }

    return { x, y };
  }

  suggestOptimalPosition(
    newComponent: Omit<CanvasComponent, 'id' | 'position'>,
    existing: CanvasComponent[]
  ): { x: number; y: number } {
    if (existing.length === 0) return { x: 50, y: 50 };

    const sameType = existing.filter(c => c.type === newComponent.type);
    if (sameType.length > 0) {
      const last = sameType[sameType.length - 1];
      const candidate = { x: last.position.x + last.size.width + this.MIN_SPACING, y: last.position.y };
      if (!this.checkOverlap(candidate, newComponent.size, existing)) return candidate;
    }

    const bottomMost = existing.reduce((max, c) =>
      c.position.y + c.size.height > max.position.y + max.size.height ? c : max
    );
    return { x: 50, y: bottomMost.position.y + bottomMost.size.height + this.MIN_SPACING };
  }

  private checkOverlap(pos: { x: number; y: number }, size: { width: number; height: number }, components: CanvasComponent[]): boolean {
    return components.some(c =>
      !(pos.x + size.width < c.position.x || pos.x > c.position.x + c.size.width ||
        pos.y + size.height < c.position.y || pos.y > c.position.y + c.size.height)
    );
  }

  generateLayoutSuggestions(components: CanvasComponent[]): LayoutSuggestion[] {
    const suggestions: LayoutSuggestion[] = [];
    const metricCards = components.filter(c => c.type === 'metric-card');

    if (metricCards.length >= 2) {
      const alignedY = metricCards[0].position.y;
      for (let i = 1; i < metricCards.length; i++) {
        const card = metricCards[i];
        if (Math.abs(card.position.y - alignedY) > this.SNAP_THRESHOLD) {
          suggestions.push({ componentId: card.id, suggestedPosition: { x: card.position.x, y: alignedY }, reason: 'Align with other metric cards' });
        }
      }
    }

    return suggestions;
  }
}

export const layoutEngine = new LayoutEngine();
