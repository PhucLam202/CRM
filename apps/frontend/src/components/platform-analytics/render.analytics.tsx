'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Integration } from '@prisma/client';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ChartSocial } from '@gitroom/frontend/components/analytics/chart-social';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

interface AnalyticsDataItem {
  label: string;
  data: Array<{ total: number | string; date: string }>;
  average?: boolean;
  percentageChange?: number;
}

interface AnalyticsMetricView extends Omit<AnalyticsDataItem, 'data'> {
  id: string;
  data: Array<{ total: number; date: string }>;
  currentValue: number;
  previousValue: number | null;
  periodTotal: number;
  averageDaily: number;
  minimumValue: number;
  maximumValue: number;
  change: number | null;
  chartMode: 'auto' | 'line' | 'bar';
}

const preferredMetricOrder = [
  'impressions',
  'likes',
  'replies',
  'retweets',
  'quotes',
  'bookmarks',
];

const compactNumber = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const formatMetricValue = (value: number, average?: boolean) => {
  if (average) {
    return `${value.toFixed(2)}%`;
  }

  return new Intl.NumberFormat().format(Math.round(value));
};

const normalizeMetricId = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const sortByDate = (points: AnalyticsDataItem['data']) =>
  [...points]
    .map((point) => ({
      ...point,
      total: Number(point.total) || 0,
    }))
    .sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
    );

const getChange = (current: number, previous: number | null) => {
  if (previous === null) {
    return null;
  }

  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
};

const getMetricPriority = (label: string) => {
  const normalized = normalizeMetricId(label);
  const priority = preferredMetricOrder.indexOf(normalized);

  return priority === -1 ? preferredMetricOrder.length : priority;
};

const TrendBadge: FC<{ value: number | null }> = ({ value }) => {
  if (value === null) {
    return <span className="text-[12px] text-newTableText/60">No previous period</span>;
  }

  const isPositive = value > 0;
  const isNeutral = value === 0;
  const tone = isNeutral ? 'text-newTableText/60' : isPositive ? 'text-[#32d583]' : 'text-[#f97066]';

  return (
    <div className={`flex items-center gap-[4px] text-[12px] font-medium ${tone}`}>
      {!isNeutral && <span className={isPositive ? '' : 'rotate-180'}>▲</span>}
      <span>{`${value > 0 ? '+' : ''}${compactNumber.format(Math.abs(value))}%`}</span>
    </div>
  );
};

const MetricCard: FC<{ item: AnalyticsMetricView }> = ({ item }) => {
  const hasLowVolume = item.data.reduce((maximum, row) => Math.max(maximum, row.total), 0) <= 10;
  const chartColor = item.id.includes('bookmark') || item.id.includes('quote') || item.id.includes('retweet')
    ? 'blue'
    : item.id.includes('like')
      ? 'green'
      : 'purple';

  return (
    <div className="rounded-[16px] border border-newTableBorder bg-newTableHeader p-[16px] shadow-sm transition-colors hover:border-[#612bd3]/50">
      <div className="flex items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-newTableText">{item.label}</div>
          <div className="mt-[8px] text-[30px] font-semibold leading-none tracking-tight text-newTableText">
            {formatMetricValue(item.periodTotal, item.average)}
          </div>
          <div className="mt-[4px] text-[12px] text-newTableText/60">Period total</div>
        </div>
        <TrendBadge value={item.change} />
      </div>

      <div className="mt-[10px] grid grid-cols-2 gap-[8px] text-[12px] text-newTableText/70">
        <div className="rounded-[10px] bg-newBgColorInner/60 px-[10px] py-[8px]">
          <div className="text-newTableText/50">Latest day</div>
          <div className="mt-[2px] font-medium text-newTableText">
            {formatMetricValue(item.currentValue, item.average)}
          </div>
        </div>
        <div className="rounded-[10px] bg-newBgColorInner/60 px-[10px] py-[8px]">
          <div className="text-newTableText/50">Previous day</div>
          <div className="mt-[2px] font-medium text-newTableText">
            {item.previousValue === null ? '—' : formatMetricValue(item.previousValue, item.average)}
          </div>
        </div>
        <div className="rounded-[10px] bg-newBgColorInner/60 px-[10px] py-[8px]">
          <div className="text-newTableText/50">Daily avg</div>
          <div className="mt-[2px] font-medium text-newTableText">
            {formatMetricValue(item.averageDaily, item.average)}
          </div>
        </div>
        <div className="rounded-[10px] bg-newBgColorInner/60 px-[10px] py-[8px]">
          <div className="text-newTableText/50">Min / Max</div>
          <div className="mt-[2px] font-medium text-newTableText">
            {formatMetricValue(item.minimumValue, item.average)} / {formatMetricValue(item.maximumValue, item.average)}
          </div>
        </div>
      </div>

      <div className="mt-[12px]">
        <ChartSocial
          data={item.data}
          color={chartColor}
          mode={hasLowVolume ? 'bar' : 'auto'}
          datasetLabel={item.label}
          height={96}
          maxTicks={4}
          showLegend={false}
        />
      </div>
    </div>
  );
};

const EmptyAnalyticsState: FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const t = useT();

  return (
    <div className="flex flex-col items-center justify-center rounded-[16px] border border-newTableBorder bg-newTableHeader px-[24px] py-[48px] text-center">
      <p className="text-[15px] text-newTableText">
        {t(
          'this_channel_needs_to_be_refreshed',
          'This channel needs to be refreshed to display analytics'
        )}
      </p>
      <button
        onClick={onRefresh}
        className="mt-[16px] inline-flex items-center gap-[6px] rounded-[8px] bg-[#612bd3] px-[16px] py-[8px] text-[14px] font-medium text-white transition-colors hover:bg-[#5023b8]"
      >
        {t('refresh_channel', 'Refresh Channel')}
      </button>
    </div>
  );
};

const ErrorAnalyticsState: FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const t = useT();

  return (
    <div className="flex flex-col items-center justify-center rounded-[16px] border border-red-500/30 bg-newTableHeader px-[24px] py-[48px] text-center">
      <p className="text-[15px] text-newTableText">
        {t('failed_to_load_analytics', 'Failed to load analytics')}
      </p>
      <button
        onClick={onRetry}
        className="mt-[16px] inline-flex items-center gap-[6px] rounded-[8px] bg-[#612bd3] px-[16px] py-[8px] text-[14px] font-medium text-white transition-colors hover:bg-[#5023b8]"
      >
        {t('try_again', 'Try again')}
      </button>
    </div>
  );
};

export const RenderAnalytics: FC<{
  integration: Integration;
  date: number;
}> = ({ integration, date }) => {
  const [selectedMetricId, setSelectedMetricId] = useState('');
  const fetch = useFetch();

  const load = useCallback(async () => {
    const response = await fetch(`/analytics/${integration.id}?date=${date}`);

    if (!response.ok) {
      throw new Error('Failed to load analytics');
    }

    return (await response.json()) as AnalyticsDataItem[];
  }, [fetch, integration.id, date]);

  const { data, error, isLoading, mutate } = useSWR(
    `/analytics-${integration.id}-${date}`,
    load,
    {
      refreshInterval: 0,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      refreshWhenOffline: false,
      revalidateOnMount: true,
    }
  );

  const refreshChannel = useCallback(async () => {
    const { url } = await (
      await fetch(
        `/integrations/social/${integration.providerIdentifier}?refresh=${integration.internalId}`,
        {
          method: 'GET',
        }
      )
    ).json();

    window.location.href = url;
  }, [fetch, integration.providerIdentifier, integration.internalId]);

  const metrics = useMemo<AnalyticsMetricView[]>(() => {
    return (data || [])
      .map((item) => {
        const points = sortByDate(item.data);
        const currentValue = points.at(-1)?.total ?? 0;
        const previousValue = points.at(-2)?.total ?? null;
        const periodTotal = points.reduce((accumulator, row) => accumulator + row.total, 0);
        const averageDaily = points.length > 0 ? periodTotal / points.length : 0;
        const minimumValue = points.reduce(
          (minimum, row) => Math.min(minimum, row.total),
          points[0]?.total ?? 0
        );
        const maximum = points.reduce((accumulator, row) => Math.max(accumulator, row.total), 0);

        return {
          ...item,
          id: normalizeMetricId(item.label),
          data: points,
          currentValue,
          previousValue,
          periodTotal,
          averageDaily,
          minimumValue,
          maximumValue: maximum,
          change: getChange(currentValue, previousValue),
          chartMode: (maximum <= 10 ? 'bar' : 'auto') as 'auto' | 'line' | 'bar',
        };
      })
      .sort((left, right) => getMetricPriority(left.label) - getMetricPriority(right.label));
  }, [data]);

  useEffect(() => {
    if (!selectedMetricId && metrics.length > 0) {
      setSelectedMetricId(metrics[0].id);
      return;
    }

    if (selectedMetricId && metrics.length > 0 && !metrics.some((item) => item.id === selectedMetricId)) {
      setSelectedMetricId(metrics[0].id);
    }
  }, [metrics, selectedMetricId]);

  const activeMetric = metrics.find((item) => item.id === selectedMetricId) || metrics[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-[48px]">
        <LoadingComponent />
      </div>
    );
  }

  if (error) {
    return <ErrorAnalyticsState onRetry={() => mutate()} />;
  }

  if (!metrics.length) {
    return <EmptyAnalyticsState onRefresh={refreshChannel} />;
  }

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((item) => (
          <MetricCard key={item.id} item={item} />
        ))}
      </div>

      <div className="rounded-[16px] border border-newTableBorder bg-newTableHeader p-[16px] shadow-sm">
        <div className="flex flex-col gap-[12px] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[14px] font-medium text-newTableText">Overview</div>
            <div className="text-[12px] text-newTableText/60">
              Switch the metric to inspect the actual daily trend.
            </div>
          </div>

          <div className="flex flex-wrap gap-[8px]">
            {metrics.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedMetricId(item.id)}
                className={`rounded-full border px-[12px] py-[6px] text-[13px] transition-colors ${
                  activeMetric?.id === item.id
                    ? 'border-[#612bd3] bg-[#612bd3] text-white'
                    : 'border-newTableBorder bg-transparent text-newTableText hover:border-[#612bd3]/50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {activeMetric && (
          <>
            <div className="mt-[16px] grid grid-cols-2 gap-[10px] md:grid-cols-4">
              <div className="rounded-[12px] bg-newBgColorInner/60 px-[12px] py-[10px]">
                <div className="text-[12px] text-newTableText/50">Total</div>
                <div className="mt-[4px] text-[18px] font-semibold text-newTableText">
                  {formatMetricValue(activeMetric.periodTotal, activeMetric.average)}
                </div>
              </div>
              <div className="rounded-[12px] bg-newBgColorInner/60 px-[12px] py-[10px]">
                <div className="text-[12px] text-newTableText/50">Latest day</div>
                <div className="mt-[4px] text-[18px] font-semibold text-newTableText">
                  {formatMetricValue(activeMetric.currentValue, activeMetric.average)}
                </div>
              </div>
              <div className="rounded-[12px] bg-newBgColorInner/60 px-[12px] py-[10px]">
                <div className="text-[12px] text-newTableText/50">Average/day</div>
                <div className="mt-[4px] text-[18px] font-semibold text-newTableText">
                  {formatMetricValue(activeMetric.averageDaily, activeMetric.average)}
                </div>
              </div>
              <div className="rounded-[12px] bg-newBgColorInner/60 px-[12px] py-[10px]">
                <div className="text-[12px] text-newTableText/50">Points</div>
                <div className="mt-[4px] text-[18px] font-semibold text-newTableText">
                  {activeMetric.data.length}
                </div>
              </div>
            </div>
            <div className="mt-[16px] h-[360px]">
              <ChartSocial
                data={activeMetric.data}
                color="purple"
                mode={activeMetric.chartMode}
                datasetLabel={activeMetric.label}
                height={360}
                maxTicks={8}
                showLegend={true}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
