'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Entity } from '@/lib/api';

interface ProductSunburstProps {
  entities: Entity[];
}

export default function ProductSunburst({ entities }: ProductSunburstProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current, 'dark');

    // Build hierarchical data from entities
    const organizations = entities.filter((e) => e.type === 'organization');
    const products = entities.filter((e) => e.type === 'product');
    const features = entities.filter((e) => e.type === 'feature');
    const technologies = entities.filter((e) => e.type === 'technology');
    const integrations = entities.filter((e) => e.type === 'integration');

    // Create sunburst data structure
    const data = [
      {
        name: organizations[0]?.name || 'Company',
        itemStyle: { color: '#667eea' },
        children: [
          {
            name: 'Products',
            itemStyle: { color: '#38ef7d' },
            children: products.slice(0, 5).map((p) => ({
              name: p.name,
              value: Math.round(p.confidence * 100),
              itemStyle: { color: '#4facfe' },
            })),
          },
          {
            name: 'Features',
            itemStyle: { color: '#f093fb' },
            children: features.slice(0, 8).map((f) => ({
              name: f.name.substring(0, 20),
              value: Math.round(f.confidence * 100),
              itemStyle: { color: '#fc466b' },
            })),
          },
          {
            name: 'Tech Stack',
            itemStyle: { color: '#ff9a44' },
            children: technologies.slice(0, 6).map((t) => ({
              name: t.name,
              value: Math.round(t.confidence * 100),
            })),
          },
          {
            name: 'Integrations',
            itemStyle: { color: '#11998e' },
            children: integrations.slice(0, 6).map((i) => ({
              name: i.name,
              value: Math.round(i.confidence * 100),
            })),
          },
        ].filter((category) => category.children.length > 0),
      },
    ];

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: 'Entity Hierarchy',
        left: 'center',
        textStyle: { color: '#fff', fontSize: 14 },
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}<br/>Confidence: {c}%',
      },
      series: [
        {
          type: 'sunburst',
          data: data,
          radius: ['15%', '90%'],
          center: ['50%', '55%'],
          sort: undefined,
          emphasis: {
            focus: 'ancestor',
          },
          levels: [
            {},
            {
              r0: '15%',
              r: '40%',
              itemStyle: { borderWidth: 2 },
              label: { rotate: 'tangential', color: '#fff', fontSize: 11 },
            },
            {
              r0: '40%',
              r: '65%',
              label: { align: 'right', color: '#fff', fontSize: 9 },
            },
            {
              r0: '65%',
              r: '90%',
              label: {
                position: 'outside',
                padding: 3,
                color: '#a0a0c0',
                fontSize: 8,
              },
              itemStyle: { borderWidth: 1 },
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
  }, [entities]);

  return (
    <div
      ref={chartRef}
      className="w-full h-[400px]"
      style={{ minHeight: '400px' }}
    />
  );
}
