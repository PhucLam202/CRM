'use client';

import { FC, useEffect, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  type ChartConfiguration,
  type TooltipItem,
} from 'chart.js';
import 'chart.js/auto';
import dayjs from 'dayjs';
import useCookie from 'react-use-cookie';
import { TotalList } from '@gitroom/frontend/components/analytics/stars.and.forks.interface';

type ChartColor = 'purple' | 'green' | 'blue';
type ChartMode = 'auto' | 'line' | 'bar';

interface ChartSocialProps {
  data: TotalList[];
  color?: ChartColor;
  mode?: ChartMode;
  datasetLabel?: string;
  height?: number;
  maxTicks?: number;
  showLegend?: boolean;
}

const colorSchemes = {
  purple: {
    border: 'rgb(97, 43, 211)',
    soft: 'rgba(97, 43, 211, 0.18)',
  },
  green: {
    border: 'rgb(50, 213, 131)',
    soft: 'rgba(50, 213, 131, 0.18)',
  },
  blue: {
    border: 'rgb(29, 155, 240)',
    soft: 'rgba(29, 155, 240, 0.18)',
  },
} satisfies Record<ChartColor, { border: string; soft: string }>;

const compactNumber = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function normalizeSeries(data: TotalList[], maxPoints: number): TotalList[] {
  if (data.length <= maxPoints) {
    return data;
  }

  const groupSize = Math.ceil(data.length / maxPoints);
  const result: TotalList[] = [];

  for (let index = 0; index < data.length; index += groupSize) {
    const slice = data.slice(index, index + groupSize);
    if (!slice.length) {
      continue;
    }

    result.push({
      date: `${slice[0].date} - ${slice[slice.length - 1].date}`,
      total: slice.reduce((accumulator, current) => accumulator + current.total, 0),
    });
  }

  return result;
}

function resolveChartType(mode: ChartMode, data: TotalList[]): 'line' | 'bar' {
  if (mode !== 'auto') {
    return mode;
  }

  const maxValue = data.reduce((maximum, row) => Math.max(maximum, row.total), 0);
  return maxValue <= 10 || data.length <= 3 ? 'bar' : 'line';
}

export const ChartSocial: FC<ChartSocialProps> = ({
  data,
  color = 'purple',
  mode = 'auto',
  datasetLabel = 'Total',
  height = 120,
  maxTicks = 6,
  showLegend = false,
}) => {
  const [theme] = useCookie('mode', 'dark');
  const series = useMemo(() => normalizeSeries(data, maxTicks), [data, maxTicks]);
  const resolvedMode = useMemo(() => resolveChartType(mode, series), [mode, series]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartJS | null>(null);

  const colors = colorSchemes[color];

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    chartRef.current?.destroy();

    const context = canvasRef.current.getContext('2d');
    if (!context) {
      return;
    }

    const configuration: ChartConfiguration<'line' | 'bar', number[], string> = {
      type: resolvedMode,
      data: {
        labels: series.map((row) => dayjs(row.date.split(' - ')[0]).format('MMM D')),
        datasets: [
          {
            label: datasetLabel,
            data: series.map((row) => row.total),
            borderColor: colors.border,
            backgroundColor: resolvedMode === 'bar' ? colors.soft : 'transparent',
            fill: false,
            borderWidth: 2,
            tension: 0.35,
            pointRadius: resolvedMode === 'bar' ? 0 : 2,
            pointHoverRadius: 4,
            pointBackgroundColor: colors.border,
            pointBorderColor: theme === 'dark' ? '#1e1d1d' : '#fff',
            pointBorderWidth: 2,
            barPercentage: 0.72,
            categoryPercentage: 0.72,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        animation: {
          duration: 450,
          easing: 'easeOutQuart',
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: showLegend,
            position: 'top',
            labels: {
              color: theme === 'dark' ? '#e5e7eb' : '#374151',
              usePointStyle: true,
              pointStyle: resolvedMode === 'bar' ? 'rect' : 'line',
              boxWidth: 10,
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: theme === 'dark' ? '#111827' : '#ffffff',
            titleColor: theme === 'dark' ? '#f9fafb' : '#111827',
            bodyColor: theme === 'dark' ? '#d1d5db' : '#374151',
            borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
            displayColors: false,
            callbacks: {
              title(items: TooltipItem<'line' | 'bar'>[]) {
                const raw = items[0]?.label ?? '';
                return raw;
              },
              label(context: TooltipItem<'line' | 'bar'>) {
                const value = Number(context.raw);
                return `${datasetLabel}: ${compactNumber.format(value)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: theme === 'dark' ? '#9ca3af' : '#6b7280',
              maxTicksLimit: maxTicks,
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
              font: {
                size: 10,
              },
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: theme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(107, 114, 128, 0.12)',
            },
            ticks: {
              color: theme === 'dark' ? '#9ca3af' : '#6b7280',
              maxTicksLimit: 4,
              font: {
                size: 10,
              },
              callback(value) {
                const numericValue = typeof value === 'number' ? value : Number(value);
                return compactNumber.format(numericValue);
              },
            },
          },
        },
      },
    };

    chartRef.current = new ChartJS(context, configuration);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [colors.border, colors.soft, datasetLabel, maxTicks, resolvedMode, series, showLegend, theme]);

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
};
