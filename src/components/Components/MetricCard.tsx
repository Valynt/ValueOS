import React from 'react';
import { MetricCardProps } from '../../types';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  change,
  tooltipId
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'down':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  return (
    <div className="bg-card text-card-foreground rounded-xl p-6 border border-border shadow-beautiful-md hover:shadow-beautiful-lg transition-all duration-200 h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            {tooltipId && <Info className="h-3 w-3 text-muted-foreground" />}
          </div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className={`p-2 rounded-lg border ${getTrendColor()}`}>
          {getTrendIcon()}
        </div>
      </div>
      
      {change && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{change}</span>
          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                trend === 'up' ? 'bg-green-500' : trend === 'down' ? 'bg-red-500' : 'bg-muted-foreground'
              }`}
              style={{ width: '75%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};