import React, { useState } from 'react';
import { InteractiveChartProps } from '../../types';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  title,
  data,
  type,
  config = {}
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const maxValue = Math.max(...data.map(item => item.value));
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const renderBarChart = () => {
    return (
      <div className="space-y-3">
        {data.map((item, index) => (
          <div 
            key={item.id}
            className="flex items-center space-x-3 cursor-pointer"
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
          >
            <div className="w-24 text-sm text-gray-700 text-right">{item.name}</div>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color || colors[index % colors.length],
                  transform: hoveredItem === item.id ? 'scaleY(1.1)' : 'scaleY(1)',
                  opacity: hoveredItem && hoveredItem !== item.id ? 0.7 : 1
                }}
              >
                {config.showValue && (
                  <span className="text-xs font-medium text-white">
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </span>
                )}
              </div>
            </div>
            <div className="w-16 text-sm text-gray-900 font-medium">
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPieChart = () => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulativePercentage = 0;

    return (
      <div className="flex items-center justify-center space-x-8">
        <div className="relative">
          <svg width="180" height="180" className="transform -rotate-90">
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const strokeDasharray = `${percentage} ${100 - percentage}`;
              const strokeDashoffset = -cumulativePercentage;
              
              cumulativePercentage += percentage;
              
              return (
                <circle
                  key={item.id}
                  cx="90"
                  cy="90"
                  r="70"
                  fill="transparent"
                  stroke={item.color || colors[index % colors.length]}
                  strokeWidth="20"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="cursor-pointer transition-all duration-300 hover:stroke-width-[25]"
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                />
              );
            })}
          </svg>
        </div>
        
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.id} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color || colors[index % colors.length] }}
              />
              <span className="text-sm text-gray-700">{item.name}</span>
              <span className="text-sm font-medium text-gray-900">
                {((item.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getChartIcon = () => {
    switch (type) {
      case 'pie':
        return <PieChart className="h-4 w-4" />;
      case 'line':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center text-gray-500">
          {getChartIcon()}
        </div>
      </div>
      
      <div className="h-full pb-6">
        {type === 'pie' ? renderPieChart() : renderBarChart()}
      </div>
    </div>
  );
};