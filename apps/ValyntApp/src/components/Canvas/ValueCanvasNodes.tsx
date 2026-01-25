/**
 * Custom Node Types for ValueCanvas
 *
 * React Flow node components for input and calculated value drivers.
 */

import React, { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import useValueCanvasStore from '@/stores/valueCanvasStore';
import { calculationEngine } from '@/services/CalculationEngine';

// Input Node - for leaf drivers that users can modify
export const InputNode = memo(({ id, data }: NodeProps) => {
  const { updateDriverValue, driverValues } = useValueCanvasStore();

  const handleValueChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value) || 0;
    updateDriverValue(id, newValue);

    // Trigger calculation
    calculationEngine.updateInput(id, newValue);
  }, [id, updateDriverValue]);

  const currentValue = driverValues[id] ?? data.value ?? 0;
  const format = data.format || 'number';

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      case 'percentage':
        return `${(value * 100).toFixed(2)}%`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <Card className="min-w-[200px] shadow-md border-2 border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-blue-900">
          {data.label || 'Input Driver'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Input
          type="number"
          value={currentValue}
          onChange={handleValueChange}
          className="text-center font-mono text-lg"
          placeholder="Enter value"
        />
        <div className="text-xs text-muted-foreground mt-1 text-center">
          {formatValue(currentValue)}
        </div>
      </CardContent>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </Card>
  );
});

InputNode.displayName = 'InputNode';

// Calculated Node - for derived values with formulas
export const CalculatedNode = memo(({ id, data }: NodeProps) => {
  const { driverValues } = useValueCanvasStore();

  const currentValue = driverValues[id] ?? data.value ?? 0;
  const format = data.format || 'number';
  const formula = data.formula || '';

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      case 'percentage':
        return `${(value * 100).toFixed(2)}%`;
      default:
        return value.toLocaleString();
    }
  };

  // Simple trend indicator (would need historical data in real implementation)
  const TrendIndicator = () => {
    // For now, just show a static indicator
    const isPositive = currentValue > 0;
    return (
      <Badge variant="outline" className="ml-2 text-xs">
        {isPositive ? (
          <TrendingUp className="w-3 h-3 text-green-500" />
        ) : (
          <TrendingDown className="w-3 h-3 text-red-500" />
        )}
      </Badge>
    );
  };

  return (
    <Card className="min-w-[200px] shadow-md border-2 border-green-200 bg-green-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-green-900 flex items-center justify-between">
          <span>{data.label || 'Calculated Driver'}</span>
          <TrendIndicator />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-center">
          <div className="text-2xl font-bold font-mono text-green-800">
            {formatValue(currentValue)}
          </div>
          {formula && (
            <div
              className="text-xs text-muted-foreground mt-2 p-1 bg-gray-100 rounded text-left font-mono"
              title={`Formula: ${formula}`}
            >
              {formula.length > 20 ? `${formula.substring(0, 20)}...` : formula}
            </div>
          )}
        </div>
      </CardContent>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </Card>
  );
});

CalculatedNode.displayName = 'CalculatedNode';

// Node types registry for React Flow
export const nodeTypes = {
  inputNode: InputNode,
  calculatedNode: CalculatedNode,
};