'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Entity } from '@/lib/api';

interface MarketRadarProps {
  entities: Entity[];
  companyName?: string;
}

export default function MarketRadar({ entities, companyName = 'Company' }: MarketRadarProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current, 'dark');

    // Calculate metrics from entities
    const productCount = entities.filter((e) => e.type === 'product').length;
    const featureCount = entities.filter((e) => e.type === 'feature').length;
    const integrationCount = entities.filter((e) => e.type === 'integration').length;
    const techCount = entities.filter((e) => e.type === 'technology').length;

    // Normalize to 0-100 scale
    const normalize = (value: number, max: number) =>
      Math.min(100, Math.round((value / max) * 100));

    const companyData = [
      normalize(featureCount, 20),      // Feature Depth
      normalize(integrationCount, 15),  // Integration Ecosystem
      Math.round(entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length * 100) || 50, // Data Quality
      normalize(techCount, 10),         // Tech Modernity
      normalize(productCount, 5),       // Product Breadth
      65, // Placeholder for metrics we can't measure yet
    ];

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: 'Capability Assessment',
        left: 'center',
        textStyle: { color: '#fff', fontSize: 14 },
      },
      tooltip: {
        trigger: 'item',
      },
      radar: {
        indicator: [
          { name: 'Feature Depth', max: 100 },
          { name: 'Integrations', max: 100 },
          { name: 'Data Quality', max: 100 },
          { name: 'Tech Stack', max: 100 },
          { name: 'Product Breadth', max: 100 },
          { name: 'Market Presence', max: 100 },
        ],
        center: ['50%', '55%'],
        radius: '65%',
        axisName: { color: '#a0a0c0', fontSize: 10 },
        splitArea: {
          areaStyle: {
            color: ['rgba(26, 26, 62, 0.8)', 'rgba(37, 37, 80, 0.8)'],
          },
        },
        axisLine: { lineStyle: { color: '#333' } },
        splitLine: { lineStyle: { color: '#333' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: companyData,
              name: companyName,
              lineStyle: { color: '#667eea', width: 2 },
              areaStyle: { color: 'rgba(102, 126, 234, 0.3)' },
              itemStyle: { color: '#667eea' },
            },
          ],
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [entities, companyName]);

  return (
    <div
      ref={chartRef}
      className="w-full h-[350px]"
      style={{ minHeight: '350px' }}
    />
  );
}
