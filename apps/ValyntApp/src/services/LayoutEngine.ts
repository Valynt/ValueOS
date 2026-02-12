import { CanvasComponent } from '../types';

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

  findAlignmentGuides(
    movingComponent: CanvasComponent,
    otherComponents: CanvasComponent[]
  ): AlignmentInfo[] {
    const guides: AlignmentInfo[] = [];
    const threshold = this.SNAP_THRESHOLD;

    const movingEdges = {
      left: movingComponent.position.x,
      right: movingComponent.position.x + movingComponent.size.width,
      top: movingComponent.position.y,
      bottom: movingComponent.position.y + movingComponent.size.height,
      centerX: movingComponent.position.x + movingComponent.size.width / 2,
      centerY: movingComponent.position.y + movingComponent.size.height / 2
    };

    for (const other of otherComponents) {
      if (other.id === movingComponent.id) continue;

      const otherEdges = {
        left: other.position.x,
        right: other.position.x + other.size.width,
        top: other.position.y,
        bottom: other.position.y + other.size.height,
        centerX: other.position.x + other.size.width / 2,
        centerY: other.position.y + other.size.height / 2
      };

      if (Math.abs(movingEdges.left - otherEdges.left) < threshold) {
        guides.push({
          orientation: 'vertical',
          position: otherEdges.left,
          alignedComponents: [other.id]
        });
      }

      if (Math.abs(movingEdges.right - otherEdges.right) < threshold) {
        guides.push({
          orientation: 'vertical',
          position: otherEdges.right,
          alignedComponents: [other.id]
        });
      }

      if (Math.abs(movingEdges.centerX - otherEdges.centerX) < threshold) {
        guides.push({
          orientation: 'vertical',
          position: otherEdges.centerX,
          alignedComponents: [other.id]
        });
      }

      if (Math.abs(movingEdges.top - otherEdges.top) < threshold) {
        guides.push({
          orientation: 'horizontal',
          position: otherEdges.top,
          alignedComponents: [other.id]
        });
      }

      if (Math.abs(movingEdges.bottom - otherEdges.bottom) < threshold) {
        guides.push({
          orientation: 'horizontal',
          position: otherEdges.bottom,
          alignedComponents: [other.id]
        });
      }

      if (Math.abs(movingEdges.centerY - otherEdges.centerY) < threshold) {
        guides.push({
          orientation: 'horizontal',
          position: otherEdges.centerY,
          alignedComponents: [other.id]
        });
      }
    }

    return guides;
  }

  snapToGrid(position: { x: number; y: number }): { x: number; y: number } {
    return {
      x: Math.round(position.x / this.GRID_SIZE) * this.GRID_SIZE,
      y: Math.round(position.y / this.GRID_SIZE) * this.GRID_SIZE
    };
  }

  snapToAlignment(
    position: { x: number; y: number },
    size: { width: number; height: number },
    guides: AlignmentInfo[]
  ): { x: number; y: number } {
    let snappedX = position.x;
    let snappedY = position.y;

    for (const guide of guides) {
      if (guide.orientation === 'vertical') {
        const distToLeft = Math.abs(position.x - guide.position);
        const distToCenter = Math.abs(position.x + size.width / 2 - guide.position);
        const distToRight = Math.abs(position.x + size.width - guide.position);

        if (distToLeft < this.SNAP_THRESHOLD) {
          snappedX = guide.position;
        } else if (distToCenter < this.SNAP_THRESHOLD) {
          snappedX = guide.position - size.width / 2;
        } else if (distToRight < this.SNAP_THRESHOLD) {
          snappedX = guide.position - size.width;
        }
      } else {
        const distToTop = Math.abs(position.y - guide.position);
        const distToCenter = Math.abs(position.y + size.height / 2 - guide.position);
        const distToBottom = Math.abs(position.y + size.height - guide.position);

        if (distToTop < this.SNAP_THRESHOLD) {
          snappedY = guide.position;
        } else if (distToCenter < this.SNAP_THRESHOLD) {
          snappedY = guide.position - size.height / 2;
        } else if (distToBottom < this.SNAP_THRESHOLD) {
          snappedY = guide.position - size.height;
        }
      }
    }

    return { x: snappedX, y: snappedY };
  }

  suggestOptimalPosition(
    newComponent: Omit<CanvasComponent, 'id' | 'position'>,
    existingComponents: CanvasComponent[]
  ): { x: number; y: number } {
    if (existingComponents.length === 0) {
      return { x: 50, y: 50 };
    }

    const componentsByType = existingComponents.filter(c => c.type === newComponent.type);

    if (componentsByType.length > 0) {
      const lastOfType = componentsByType[componentsByType.length - 1];
      const suggestedX = lastOfType.position.x + lastOfType.size.width + this.MIN_SPACING;
      const suggestedY = lastOfType.position.y;

      const wouldOverlap = this.checkOverlap(
        { x: suggestedX, y: suggestedY },
        newComponent.size,
        existingComponents
      );

      if (!wouldOverlap) {
        return { x: suggestedX, y: suggestedY };
      }
    }

    const bottomMost = existingComponents.reduce((max, comp) =>
      comp.position.y + comp.size.height > max.position.y + max.size.height ? comp : max
    );

    return {
      x: 50,
      y: bottomMost.position.y + bottomMost.size.height + this.MIN_SPACING
    };
  }

  private checkOverlap(
    position: { x: number; y: number },
    size: { width: number; height: number },
    components: CanvasComponent[]
  ): boolean {
    for (const comp of components) {
      const overlap = !(
        position.x + size.width < comp.position.x ||
        position.x > comp.position.x + comp.size.width ||
        position.y + size.height < comp.position.y ||
        position.y > comp.position.y + comp.size.height
      );

      if (overlap) return true;
    }

    return false;
  }

  generateLayoutSuggestions(components: CanvasComponent[]): LayoutSuggestion[] {
    const suggestions: LayoutSuggestion[] = [];

    const metricCards = components.filter(c => c.type === 'metric-card');

    if (metricCards.length >= 2) {
      const firstCard = metricCards[0];
      const alignedY = firstCard.position.y;

      for (let i = 1; i < metricCards.length; i++) {
        const card = metricCards[i];
        if (Math.abs(card.position.y - alignedY) > this.SNAP_THRESHOLD) {
          suggestions.push({
            componentId: card.id,
            suggestedPosition: { x: card.position.x, y: alignedY },
            reason: 'Align with other metric cards'
          });
        }
      }
    }

    return suggestions;
  }
}

export const layoutEngine = new LayoutEngine();
