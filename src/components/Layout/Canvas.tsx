import React, { useRef } from 'react';
import { CanvasComponent } from '../../types';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { CanvasGrid } from '../Canvas/CanvasGrid';
import { SelectionBox } from '../Canvas/SelectionBox';
import { MetricCard } from '../Components/MetricCard';
import { InteractiveChart } from '../Components/InteractiveChart';
import { DataTable } from '../Components/DataTable';
import { NarrativeBlock } from '../Components/NarrativeBlock';

interface CanvasProps {
  components: CanvasComponent[];
  selectedComponent: CanvasComponent | null;
  onSelectComponent: (component: CanvasComponent | null) => void;
  onUpdateComponent: (id: string, updates: Partial<CanvasComponent>) => void;
  highlightedComponentId?: string | null;
}

export const Canvas: React.FC<CanvasProps> = ({
  components,
  selectedComponent,
  onSelectComponent,
  onUpdateComponent,
  highlightedComponentId
}) => {
  const { canvasRef, handleMouseDown, isDragging } = useDragAndDrop(
    components,
    onUpdateComponent
  );

  const renderComponent = (component: CanvasComponent) => {
    const isSelected = selectedComponent?.id === component.id;
    const isHighlighted = highlightedComponentId === component.id;

    const baseProps = {
      className: `absolute transition-all duration-200 ${
        isSelected
          ? 'shadow-lg z-10 ring-2 ring-blue-500'
          : isHighlighted
          ? 'shadow-lg ring-2 ring-yellow-400 z-10'
          : 'hover:shadow-md cursor-grab active:cursor-grabbing'
      }`,
      style: {
        left: component.position.x,
        top: component.position.y,
        width: component.size.width,
        height: component.type === 'narrative-block' ? 'auto' : component.size.height,
        minHeight: component.type === 'narrative-block' ? component.size.height : undefined,
        cursor: isDragging ? 'grabbing' : 'grab'
      },
      onMouseDown: (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectComponent(component);
        handleMouseDown(e, component);
      },
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
      }
    };

    switch (component.type) {
      case 'metric-card':
        return (
          <div key={component.id} {...baseProps}>
            <MetricCard {...component.props} />
          </div>
        );
      case 'interactive-chart':
        return (
          <div key={component.id} {...baseProps}>
            <InteractiveChart {...component.props} />
          </div>
        );
      case 'data-table':
        return (
          <div key={component.id} {...baseProps}>
            <DataTable {...component.props} />
          </div>
        );
      case 'narrative-block':
        return (
          <div key={component.id} {...baseProps}>
            <NarrativeBlock {...component.props} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={canvasRef}
      className="flex-1 bg-gray-50 relative overflow-auto p-4 select-none canvas-container"
      onClick={() => onSelectComponent(null)}
    >
      <CanvasGrid gridSize={20} opacity={0.3} />

      {components.map(renderComponent)}

      {components.map(component => (
        <SelectionBox
          key={`selection-${component.id}`}
          component={component}
          isSelected={selectedComponent?.id === component.id}
          onResize={(id, size) => onUpdateComponent(id, { size })}
        />
      ))}
    </div>
  );
};