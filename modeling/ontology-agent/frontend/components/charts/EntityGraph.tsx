'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Entity, Relationship } from '@/lib/api';

interface EntityGraphProps {
  entities: Entity[];
  relationships: Relationship[];
}

const typeColors: Record<string, string> = {
  organization: '#667eea',
  product: '#38ef7d',
  feature: '#4facfe',
  person: '#f093fb',
  technology: '#fc466b',
  integration: '#ff9a44',
  customer: '#11998e',
  competitor: '#764ba2',
};

export default function EntityGraph({ entities, relationships }: EntityGraphProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    chartInstance.current = echarts.init(chartRef.current, 'dark');

    // Build nodes and edges
    const nodes = entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      symbolSize: Math.max(20, Math.min(60, entity.confidence * 60)),
      category: entity.type,
      itemStyle: {
        color: typeColors[entity.type] || '#667eea',
      },
      label: {
        show: true,
        fontSize: 10,
        color: '#fff',
      },
    }));

    const edges = relationships.map((rel) => ({
      source: rel.source_id,
      target: rel.target_id,
      lineStyle: {
        color: '#666',
        width: rel.confidence * 2,
        curveness: 0.2,
      },
    }));

    // Get unique categories
    const categories = [...new Set(entities.map((e) => e.type))].map((type) => ({
      name: type,
      itemStyle: { color: typeColors[type] || '#667eea' },
    }));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: 'Entity Network',
        subtext: `${entities.length} entities • ${relationships.length} relationships`,
        left: 'center',
        textStyle: { color: '#fff', fontSize: 16 },
        subtextStyle: { color: '#a0a0c0' },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            const entity = entities.find((e) => e.id === params.data.id);
            return `
              <strong>${params.data.name}</strong><br/>
              Type: ${entity?.type}<br/>
              Confidence: ${Math.round((entity?.confidence || 0) * 100)}%
            `;
          }
          return '';
        },
      },
      legend: {
        data: categories.map((c) => c.name),
        orient: 'vertical',
        right: 10,
        top: 20,
        textStyle: { color: '#a0a0c0', fontSize: 10 },
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          data: nodes,
          edges: edges,
          categories: categories,
          force: {
            repulsion: 200,
            edgeLength: [80, 150],
            gravity: 0.1,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: { width: 4 },
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    // Resize handler
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [entities, relationships]);

  return (
    <div
      ref={chartRef}
      className="w-full h-[500px] rounded-lg"
      style={{ minHeight: '500px' }}
    />
  );
}
