/**
 * ValueDriverCard - Draggable card for value drivers on the canvas
 */

import { Edit, Trash2 } from 'lucide-react';
import React from 'react';
import { useDrag } from 'react-dnd';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CanvasComponent } from '@/types/valueDriver';

interface ValueDriverCardProps {
  component: CanvasComponent;
  onEdit: () => void;
  onDelete: () => void;
  onValueChange: (value: any) => void;
}

export const ValueDriverCard: React.FC<ValueDriverCardProps> = ({
  component,
  onEdit,
  onDelete,
  onValueChange,
}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'canvasComponent',
    item: { id: component.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const driver = component.props.driver;

  return (
    <Card ref={drag} className={`cursor-move ${isDragging ? 'opacity-50' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{driver.name}</CardTitle>
        <div>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <label className="text-xs font-medium">Value</label>
          <Input
            type="number"
            value={component.props.value || ''}
            onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
          />
          <div className="text-xs text-gray-500">
            Type: {driver.type} | Unit: {driver.unit}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};