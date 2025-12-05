import { logger } from '../lib/logger';
import { CanvasComponent } from '../types';

export interface BatchOperation {
  type: 'align' | 'distribute' | 'resize' | 'delete' | 'duplicate' | 'group';
  componentIds: string[];
  params?: any;
}

export interface BatchResult {
  success: boolean;
  updatedComponents: CanvasComponent[];
  errors?: string[];
}

class BatchOperations {
  alignComponents(
    components: CanvasComponent[],
    componentIds: string[],
    alignment: 'left' | 'right' | 'top' | 'bottom' | 'center-horizontal' | 'center-vertical'
  ): CanvasComponent[] {
    const selectedComponents = components.filter(c => componentIds.includes(c.id));
    if (selectedComponents.length < 2) return components;

    let referenceValue: number;

    switch (alignment) {
      case 'left':
        referenceValue = Math.min(...selectedComponents.map(c => c.position.x));
        return components.map(c =>
          componentIds.includes(c.id) ? { ...c, position: { ...c.position, x: referenceValue } } : c
        );

      case 'right':
        referenceValue = Math.max(...selectedComponents.map(c => c.position.x + c.size.width));
        return components.map(c =>
          componentIds.includes(c.id)
            ? { ...c, position: { ...c.position, x: referenceValue - c.size.width } }
            : c
        );

      case 'top':
        referenceValue = Math.min(...selectedComponents.map(c => c.position.y));
        return components.map(c =>
          componentIds.includes(c.id) ? { ...c, position: { ...c.position, y: referenceValue } } : c
        );

      case 'bottom':
        referenceValue = Math.max(...selectedComponents.map(c => c.position.y + c.size.height));
        return components.map(c =>
          componentIds.includes(c.id)
            ? { ...c, position: { ...c.position, y: referenceValue - c.size.height } }
            : c
        );

      case 'center-horizontal':
        const avgX = selectedComponents.reduce((sum, c) => sum + c.position.x + c.size.width / 2, 0) / selectedComponents.length;
        return components.map(c =>
          componentIds.includes(c.id)
            ? { ...c, position: { ...c.position, x: avgX - c.size.width / 2 } }
            : c
        );

      case 'center-vertical':
        const avgY = selectedComponents.reduce((sum, c) => sum + c.position.y + c.size.height / 2, 0) / selectedComponents.length;
        return components.map(c =>
          componentIds.includes(c.id)
            ? { ...c, position: { ...c.position, y: avgY - c.size.height / 2 } }
            : c
        );

      default:
        return components;
    }
  }

  distributeComponents(
    components: CanvasComponent[],
    componentIds: string[],
    direction: 'horizontal' | 'vertical'
  ): CanvasComponent[] {
    const selectedComponents = components.filter(c => componentIds.includes(c.id));
    if (selectedComponents.length < 3) return components;

    const sorted = [...selectedComponents].sort((a, b) =>
      direction === 'horizontal'
        ? a.position.x - b.position.x
        : a.position.y - b.position.y
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const totalSpace = direction === 'horizontal'
      ? (last.position.x + last.size.width) - first.position.x
      : (last.position.y + last.size.height) - first.position.y;

    const totalComponentSize = sorted.reduce((sum, c) =>
      sum + (direction === 'horizontal' ? c.size.width : c.size.height), 0
    );

    const spacing = (totalSpace - totalComponentSize) / (sorted.length - 1);

    let currentPos = direction === 'horizontal' ? first.position.x : first.position.y;

    const updatedPositions = new Map<string, { x: number; y: number }>();

    sorted.forEach((component, index) => {
      if (index === 0 || index === sorted.length - 1) {
        return;
      }

      if (direction === 'horizontal') {
        currentPos += sorted[index - 1].size.width + spacing;
        updatedPositions.set(component.id, { x: currentPos, y: component.position.y });
      } else {
        currentPos += sorted[index - 1].size.height + spacing;
        updatedPositions.set(component.id, { x: component.position.x, y: currentPos });
      }
    });

    return components.map(c => {
      const newPos = updatedPositions.get(c.id);
      return newPos ? { ...c, position: newPos } : c;
    });
  }

  resizeComponents(
    components: CanvasComponent[],
    componentIds: string[],
    size: { width?: number; height?: number }
  ): CanvasComponent[] {
    return components.map(c =>
      componentIds.includes(c.id)
        ? {
            ...c,
            size: {
              width: size.width ?? c.size.width,
              height: size.height ?? c.size.height
            }
          }
        : c
    );
  }

  deleteComponents(
    components: CanvasComponent[],
    componentIds: string[]
  ): CanvasComponent[] {
    return components.filter(c => !componentIds.includes(c.id));
  }

  duplicateComponents(
    components: CanvasComponent[],
    componentIds: string[],
    offset: { x: number; y: number } = { x: 20, y: 20 }
  ): CanvasComponent[] {
    const toDuplicate = components.filter(c => componentIds.includes(c.id));
    const duplicated = toDuplicate.map(c => ({
      ...c,
      id: crypto.randomUUID(),
      position: {
        x: c.position.x + offset.x,
        y: c.position.y + offset.y
      }
    }));

    return [...components, ...duplicated];
  }

  executeBatch(
    components: CanvasComponent[],
    operations: BatchOperation[]
  ): BatchResult {
    let updatedComponents = [...components];
    const errors: string[] = [];

    try {
      for (const operation of operations) {
        switch (operation.type) {
          case 'align':
            updatedComponents = this.alignComponents(
              updatedComponents,
              operation.componentIds,
              operation.params.alignment
            );
            break;

          case 'distribute':
            updatedComponents = this.distributeComponents(
              updatedComponents,
              operation.componentIds,
              operation.params.direction
            );
            break;

          case 'resize':
            updatedComponents = this.resizeComponents(
              updatedComponents,
              operation.componentIds,
              operation.params.size
            );
            break;

          case 'delete':
            updatedComponents = this.deleteComponents(
              updatedComponents,
              operation.componentIds
            );
            break;

          case 'duplicate':
            updatedComponents = this.duplicateComponents(
              updatedComponents,
              operation.componentIds,
              operation.params?.offset
            );
            break;

          default:
            errors.push(`Unknown operation type: ${operation.type}`);
        }
      }

      return {
        success: errors.length === 0,
        updatedComponents,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        success: false,
        updatedComponents: components,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
}

export const batchOperations = new BatchOperations();
