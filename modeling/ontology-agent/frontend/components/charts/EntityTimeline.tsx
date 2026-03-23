'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Entity } from '@/lib/api';

interface EntityTimelineProps {
  entities: Entity[];
}

const typeColors: Record<string, string> = {
  organization: '#667eea',
  product: '#38ef7d',
  feature: '#4facfe',
  person: '#f093fb',
  technology: '#fc466b',
  integration: '#ff9a44',
};

export default function EntityTimeline({ entities }: EntityTimelineProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current, 'dark');

    // Group entities by type for stacked bar chart
    const types = ['organization', 'product', 'feature', 'technology', 'integration', 'person'];
    
    // Simulate discovery timeline (entities discovered in phases)
    const phases = ['Initial', 'Crawl', 'Extract', 'Enrich', 'Resolve'];
    
    // Distribute entities across phases (simulation)
    const phaseData: Record<string, number[]> = {};
    types.forEach((type) => {
      const typeEntities = entities.filter((e) => e.type === type);
      const total = typeEntities.length;
      // Distribute roughly across phases
      phaseData[type] = [
        Math.floor(total * 0.1),
        Math.floor(total * 0.3),
        Math.floor(total * 0.35),
        Math.floor(total * 0.15),
        total - Math.floor(total * 0.1) - Math.floor(total * 0.3) - Math.floor(total * 0.35) - Math.floor(total * 0.15),
      ];
    });

    const series = types.map((type) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      type: 'bar' as const,
      stack: 'total',
      itemStyle: { color: typeColors[type] || '#667eea' },
      data: phaseData[type] || [0, 0, 0, 0, 0],
    }));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: 'Discovery Timeline',
        left: 'center',
        textStyle: { color: '#fff', fontSize: 14 },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        data: types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)),
        bottom: 0,
        textStyle: { color: '#a0a0c0', fontSize: 10 },
      },
      grid: {
        left: '10%',
        right: '10%',
        top: '15%',
        bottom: '20%',
      },
      xAxis: {
        type: 'category',
        data: phases,
        axisLabel: { color: '#a0a0c0' },
        axisLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'value',
        name: 'Entities',
        axisLabel: { color: '#a0a0c0' },
        axisLine: { lineStyle: { color: '#333' } },
        splitLine: { lineStyle: { color: '#252550' } },
      },
      series: series,
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [entities]);

  return (
    <div
      ref={chartRef}
      className="w-full h-[350px]"
      style={{ minHeight: '350px' }}
    />
  );
}
