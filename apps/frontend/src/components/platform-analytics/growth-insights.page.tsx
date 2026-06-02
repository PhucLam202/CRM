'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { capitalize, orderBy } from 'lodash';
import { useRouter } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { Button } from '@gitroom/react/form/button';
import { Select } from '@gitroom/react/form/select';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';

interface AnalyticsIntegration {
  id: string;
  identifier: string;
  name: string;
  picture?: string;
  disabled?: boolean;
  refreshNeeded?: boolean;
  type?: string;
}

interface GrowthInsightAccount {
  integrationId: string;
  provider: string;
  name: string;
}

interface GrowthRecommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  reason: string;
  expectedImpact: string;
}

interface GrowthTemplate {
  type: string;
  title: string;
  template: string;
  placeholders: string[];
  useCase: string;
  reason: string;
  source?: 'approved_library' | 'pattern_match' | 'fallback';
}

interface ContentPattern {
  pattern: string;
  evidence: string;
  impact: string;
  strength: number;
}

interface DailySuggestion {
  dayNumber: number;
  date: string;
  title: string;
  suggestedContent: string;
  focus: string;
  scheduledTime: string;
  scheduledAt: string;
  templateType: string;
  reason: string;
}

interface GrowthInsightResponse {
  id: string;
  period: {
    from: string;
    to: string;
    days: number;
  };
  account: GrowthInsightAccount;
  sourceStats: {
    postsAnalyzed: number;
    snapshotsUsed: number;
    metricsFetched: number;
    fromDatabase: boolean;
    periodDays?: number;
  };
  summary: string;
  diagnosis: Record<string, string>;
  contentPatterns: ContentPattern[];
  recommendations: GrowthRecommendation[];
  templates: GrowthTemplate[];
  scoreBreakdown: Record<string, number | string>;
  createdAt: string;
  niche?: string;
  growthGoal?: string;
  language?: string;
  dailySuggestions?: DailySuggestion[];
}

interface BestTimeResponse {
  status: 'ready' | 'insufficient_data';
  minimumPosts: number;
  postsAnalyzed: number;
  slots: Array<{
    dayOfWeek: number;
    hour: number;
    score: number;
    sampleSize: number;
    avgEngagementRate: number;
  }>;
}

interface EngagementTimeSeriesResponse {
  points: Array<{
    date: string;
    posts: number;
    avgEngagementRate: number;
  }>;
}

interface ContentTypePerformanceResponse {
  items: Array<{
    format: string;
    posts: number;
    avgEngagementRate: number;
    bestPostId: string | null;
  }>;
}

const allowedIntegrations = [
  'facebook',
  'instagram',
  'instagram-standalone',
  'linkedin-page',
  'tiktok',
  'youtube',
  'gmb',
  'pinterest',
  'threads',
  'x',
];

const priorityTone: Record<GrowthRecommendation['priority'], string> = {
  high: 'border-[#f97066]/40 bg-[#f97066]/10 text-[#f97066]',
  medium: 'border-[#fdb022]/40 bg-[#fdb022]/10 text-[#fdb022]',
  low: 'border-[#32d583]/40 bg-[#32d583]/10 text-[#32d583]',
};

const templateTypeOptions = [
  { value: 'contrarian_hook', label: 'Contrarian Hook' },
  { value: 'educational_breakdown', label: 'Educational Breakdown' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'build_in_public', label: 'Build in Public' },
  { value: 'hidden_angle', label: 'Hidden Angle' },
  { value: 'thread_starter', label: 'Thread Starter' },
  { value: 'resource_list', label: 'Resource List' },
  { value: 'myth_buster', label: 'Myth Buster' },
  { value: 'quick_checklist', label: 'Quick Checklist' },
  { value: 'question_prompt', label: 'Question Prompt' },
];

const formatLabel = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');

const formatMetricValue = (value: number | string) => {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  return String(value).replace(/_/g, ' ');
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const weekdayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const GrowthInsightsPage = () => {
  const fetch = useFetch();
  const router = useRouter();
  const toaster = useToaster();
  const modal = useModals();
  const { disableXAnalytics } = useVariables();

  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [range, setRange] = useState('7');
  const [niche, setNiche] = useState('ai_tech');
  const [growthGoal, setGrowthGoal] = useState('5_days');
  const [language, setLanguage] = useState('en');
  const [templateCount, setTemplateCount] = useState('10');
  const [templateFocus, setTemplateFocus] = useState('all');
  const [customFrom, setCustomFrom] = useState(dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [customTo, setCustomTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [isGenerating, setIsGenerating] = useState(false);

  const loadIntegrations = useCallback(async () => {
    const response = await fetch('/integrations/list');
    if (!response.ok) {
      throw new Error('Failed to load integrations');
    }

    const payload = (await response.json()) as { integrations?: AnalyticsIntegration[] };
    return (payload.integrations || []).filter((integration) => {
      if (integration.identifier === 'x' && disableXAnalytics) {
        return false;
      }

      return allowedIntegrations.includes(integration.identifier);
    });
  }, [disableXAnalytics, fetch]);

  const {
    data: integrations = [],
    isLoading: isLoadingIntegrations,
    error: integrationsError,
  } = useSWR('insights-integrations-list', loadIntegrations, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });

  const sortedIntegrations = useMemo(
    () => orderBy(integrations, ['type', 'disabled', 'identifier'], ['desc', 'asc', 'asc']),
    [integrations]
  );

  useEffect(() => {
    if (!sortedIntegrations.length) {
      return;
    }

    if (!selectedIntegrationId) {
      setSelectedIntegrationId(sortedIntegrations[0].id);
      return;
    }

    if (!sortedIntegrations.some((integration) => integration.id === selectedIntegrationId)) {
      setSelectedIntegrationId(sortedIntegrations[0].id);
    }
  }, [selectedIntegrationId, sortedIntegrations]);

  const currentIntegration = useMemo(
    () => sortedIntegrations.find((integration) => integration.id === selectedIntegrationId) || sortedIntegrations[0],
    [selectedIntegrationId, sortedIntegrations]
  );

  const period = useMemo(() => {
    if (range === 'custom') {
      return { from: customFrom, to: customTo };
    }

    const days = Number(range);
    return {
      from: dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD'),
      to: dayjs().format('YYYY-MM-DD'),
    };
  }, [customFrom, customTo, range]);

  const loadLatestInsight = useCallback(async () => {
    if (!currentIntegration) {
      return null;
    }

    const response = await fetch(`/analytics/${currentIntegration.id}/growth-insights/latest`);
    if (!response.ok) {
      throw new Error('Failed to load growth insight');
    }

    return (await response.json()) as GrowthInsightResponse | null;
  }, [currentIntegration, fetch]);

  const loadInsightHistory = useCallback(async () => {
    if (!currentIntegration) {
      return [];
    }

    const response = await fetch(`/analytics/${currentIntegration.id}/growth-insights/history?limit=5`);
    if (!response.ok) {
      throw new Error('Failed to load insight history');
    }

    return (await response.json()) as GrowthInsightResponse[];
  }, [currentIntegration, fetch]);

  const loadBestTimes = useCallback(async () => {
    if (!currentIntegration) {
      return null;
    }

    const response = await fetch(`/analytics/${currentIntegration.id}/best-times?from=${period.from}&to=${period.to}`);
    if (!response.ok) {
      throw new Error('Failed to load best times');
    }

    return (await response.json()) as BestTimeResponse;
  }, [currentIntegration, fetch, period.from, period.to]);

  const loadEngagementTimeSeries = useCallback(async () => {
    if (!currentIntegration) {
      return null;
    }

    const response = await fetch(`/analytics/${currentIntegration.id}/engagement-timeseries?from=${period.from}&to=${period.to}&bucket=day`);
    if (!response.ok) {
      throw new Error('Failed to load engagement series');
    }

    return (await response.json()) as EngagementTimeSeriesResponse;
  }, [currentIntegration, fetch, period.from, period.to]);

  const loadContentTypes = useCallback(async () => {
    if (!currentIntegration) {
      return null;
    }

    const response = await fetch(`/analytics/${currentIntegration.id}/content-types/performance?from=${period.from}&to=${period.to}`);
    if (!response.ok) {
      throw new Error('Failed to load content types');
    }

    return (await response.json()) as ContentTypePerformanceResponse;
  }, [currentIntegration, fetch, period.from, period.to]);

  const {
    data: latestInsight,
    isLoading: isLoadingLatestInsight,
    error: latestInsightError,
    mutate: mutateLatestInsight,
  } = useSWR(currentIntegration ? `insights-${currentIntegration.id}-latest` : null, loadLatestInsight, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });

  const {
    data: insightHistory = [],
    isLoading: isLoadingHistory,
    error: insightHistoryError,
    mutate: mutateInsightHistory,
  } = useSWR(currentIntegration ? `insights-${currentIntegration.id}-history` : null, loadInsightHistory, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });

  const { data: bestTimes } = useSWR(
    currentIntegration ? `insights-${currentIntegration.id}-best-times-${period.from}-${period.to}` : null,
    loadBestTimes,
    { revalidateOnFocus: false }
  );

  const { data: engagementSeries } = useSWR(
    currentIntegration ? `insights-${currentIntegration.id}-engagement-series-${period.from}-${period.to}` : null,
    loadEngagementTimeSeries,
    { revalidateOnFocus: false }
  );

  const { data: contentTypes } = useSWR(
    currentIntegration ? `insights-${currentIntegration.id}-content-types-${period.from}-${period.to}` : null,
    loadContentTypes,
    { revalidateOnFocus: false }
  );

  const generateInsights = useCallback(async () => {
    if (!currentIntegration) {
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`/analytics/${currentIntegration.id}/growth-insights/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...period,
          niche,
          growthGoal,
          language,
          templateCount: Number(templateCount),
          templateTypes: templateFocus === 'all' ? [] : [templateFocus],
          forceRefresh: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to generate growth insight');
      }

      const insight = (await response.json()) as GrowthInsightResponse;
      await mutateLatestInsight(insight, false);
      await mutateInsightHistory();
      toaster.show('Growth insight generated', 'success');
    } catch (error) {
      toaster.show(error instanceof Error ? error.message : 'Failed to generate growth insight', 'warning');
    } finally {
      setIsGenerating(false);
    }
  }, [currentIntegration, fetch, mutateInsightHistory, mutateLatestInsight, period, niche, growthGoal, language, templateCount, templateFocus, toaster]);

  const saveTemplate = useCallback(
    async (template: GrowthTemplate, insightId: string) => {
      if (!currentIntegration) {
        return;
      }

      const response = await fetch(`/analytics/${currentIntegration.id}/content-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...template, sourceInsightId: insightId }),
      });

      toaster.show(response.ok ? 'Template saved' : 'Failed to save template', response.ok ? 'success' : 'warning');
    },
    [currentIntegration, fetch, toaster]
  );

  const copyTemplate = useCallback(
    async (template: string) => {
      await navigator.clipboard.writeText(template);
      toaster.show('Template copied', 'success');
    },
    [toaster]
  );

  const scheduleSuggestedPost = useCallback(
    async (content: string, scheduledAt: string) => {
      if (!currentIntegration) {
        return;
      }

      modal.openModal({
        id: 'add-edit-modal',
        closeOnClickOutside: false,
        removeLayout: true,
        closeOnEscape: false,
        withCloseButton: false,
        askClose: true,
        fullScreen: true,
        classNames: {
          modal: 'w-[100%] max-w-[1400px] text-textColor',
        },
        children: (
          <AddEditModal
            allIntegrations={integrations as any}
            reopenModal={() => {}}
            mutate={() => {}}
            integrations={integrations as any}
            onlyValues={[{ content }]}
            date={dayjs(scheduledAt)}
          />
        ),
        size: '80%',
        title: ``,
      });
    },
    [currentIntegration, integrations, modal]
  );

  if (isLoadingIntegrations) {
    return (
      <div className="flex flex-1 items-center justify-center bg-newBgColorInner p-[20px]">
        <LoadingComponent />
      </div>
    );
  }

  if (!sortedIntegrations.length) {
    if (integrationsError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-[15px] bg-newBgColorInner p-[20px] text-center">
          <div className="text-[28px] font-medium text-newTableText">Failed to load Insights</div>
          <div className="text-[14px] text-newTableText/70">Please try again in a moment.</div>
          <Button onClick={() => router.refresh()}>Retry</Button>
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[15px] bg-newBgColorInner p-[20px] text-center">
        <div>
          <img src="/peoplemarketplace.svg" />
        </div>
        <div className="text-[36px] leading-[1.2] text-newTableText">
          Can&apos;t show insights yet
          <br />
          Add a supported social channel first
        </div>
        <div className="text-[18px] text-newTableText/70">
          Supported: {allowedIntegrations.map((integration) => capitalize(integration)).join(', ')}
        </div>
        <Button onClick={() => router.push('/launches')}>Go to the calendar to add channels</Button>
      </div>
    );
  }

  const insight = latestInsight ?? null;
  const selectedAccountName = insight?.account?.name || currentIntegration?.name || 'Selected account';
  const selectedProvider = insight?.account?.provider || currentIntegration?.identifier || '';

  return (
    <div className="flex flex-1 flex-col gap-[18px] bg-newBgColorInner p-[20px]">
      <section className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[20px] shadow-sm">
        <div className="flex flex-col gap-[18px] xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[760px]">
            <div className="text-[24px] font-semibold text-newTableText">Growth Intelligence</div>
            <div className="mt-[6px] text-[13px] leading-6 text-newTableText/60">
              Explain why performance changed, what to do next, and reuse the best content patterns across future posts.
            </div>

            <div className="mt-[18px] grid gap-[12px] md:grid-cols-3">
              <div className="rounded-[14px] bg-newBgColorInner p-[14px]">
                <div className="text-[12px] text-newTableText/50">Selected account</div>
                <div className="mt-[6px] text-[14px] font-medium text-newTableText">{selectedAccountName}</div>
              </div>
              <div className="rounded-[14px] bg-newBgColorInner p-[14px]">
                <div className="text-[12px] text-newTableText/50">Provider</div>
                <div className="mt-[6px] text-[14px] font-medium text-newTableText">
                  {selectedProvider ? capitalize(selectedProvider) : 'Unknown'}
                </div>
              </div>
              <div className="rounded-[14px] bg-newBgColorInner p-[14px]">
                <div className="text-[12px] text-newTableText/50">Current period</div>
                <div className="mt-[6px] text-[14px] font-medium text-newTableText">
                  {period.from} to {period.to}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-[12px] xl:min-w-[420px]">
            <div className="rounded-[14px] border border-newTableBorder bg-newBgColorInner p-[14px]">
              <div className="text-[12px] text-newTableText/50">Integration context</div>
              <div className="mt-[10px] flex items-center gap-[12px]">
                {currentIntegration?.picture ? (
                  <div className="relative h-[40px] w-[40px] overflow-hidden rounded-[10px] border border-newTableBorder">
                    <ImageWithFallback
                      fallbackSrc={`/icons/platforms/${currentIntegration.identifier}.png`}
                      src={currentIntegration.picture}
                      className="h-full w-full rounded-[10px] object-cover"
                      alt={currentIntegration.identifier}
                      width={40}
                      height={40}
                    />
                    <SafeImage
                      src={`/icons/platforms/${currentIntegration.identifier}.png`}
                      className="absolute bottom-[2px] end-[2px] rounded-[6px] border border-fifth"
                      alt={currentIntegration.identifier}
                      width={16}
                      height={16}
                    />
                  </div>
                ) : (
                  <div className="flex h-[40px] w-[40px] items-center justify-center rounded-[10px] border border-newTableBorder bg-newTableHeader text-[12px] font-medium uppercase text-newTableText/60">
                    {currentIntegration?.identifier?.slice(0, 2) || 'NA'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-newTableText">{currentIntegration?.name}</div>
                  <div className="text-[12px] text-newTableText/50">
                    {currentIntegration?.disabled ? 'Disabled' : 'Active'} {currentIntegration?.identifier ? `· ${capitalize(currentIntegration.identifier)}` : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-[12px] sm:grid-cols-2">
              <div>
                <Select
                  label="Account"
                  name="growthIntegration"
                  value={currentIntegration?.id || selectedIntegrationId}
                  disableForm={true}
                  hideErrors={true}
                  onChange={(event) => setSelectedIntegrationId(event.target.value)}
                >
                  {sortedIntegrations.map((integration) => (
                    <option key={integration.id} value={integration.id}>
                      {integration.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Select
                  label="Period"
                  name="growthRange"
                  value={range}
                  disableForm={true}
                  hideErrors={true}
                  onChange={(event) => setRange(event.target.value)}
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="custom">Custom</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-[12px] sm:grid-cols-2">
              <div>
                <Select
                  label="Niche Strategy"
                  name="growthNiche"
                  value={niche}
                  disableForm={true}
                  hideErrors={true}
                  onChange={(event) => setNiche(event.target.value)}
                >
                  <option value="ai_tech">AI & Tech</option>
                  <option value="business_saas">SaaS / Business</option>
                  <option value="crypto_finance">Web3 / Crypto</option>
                  <option value="marketing_copy">Marketing / Growth</option>
                  <option value="productivity_growth">Personal Growth / Productivity</option>
                </Select>
              </div>

              <div>
                <Select
                  label="Growth Goal"
                  name="growthGoal"
                  value={growthGoal}
                  disableForm={true}
                  hideErrors={true}
                  onChange={(event) => setGrowthGoal(event.target.value)}
                >
                  <option value="5_days">Next 5 Days Plan</option>
                  <option value="7_days">Next Week Plan (7 Days)</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-[12px] sm:grid-cols-3">
              <div>
                <Select
                  label="Language"
                  name="growthLanguage"
                  value={language}
                  disableForm={true}
                  hideErrors={true}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="en">English</option>
                  <option value="vi">Vietnamese</option>
                </Select>
              </div>

              <div>
                <Select
                  label="Template Count"
                  name="templateCount"
                  value={templateCount}
                  disableForm={true}
                  hideErrors={true}
                  onChange={(event) => setTemplateCount(event.target.value)}
                >
                  <option value="3">3 templates</option>
                  <option value="5">5 templates</option>
                  <option value="10">10 templates</option>
                  <option value="15">15 templates</option>
                  <option value="20">20 templates</option>
                </Select>
              </div>

              <div>
                <Select
                  label="Template Focus"
                  name="templateFocus"
                  value={templateFocus}
                  disableForm={true}
                  hideErrors={true}
                  onChange={(event) => setTemplateFocus(event.target.value)}
                >
                  <option value="all">All approved templates</option>
                  {templateTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {range === 'custom' && (
              <div className="flex flex-col gap-[10px] sm:flex-row">
                <input
                  className="rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[10px] py-[8px] text-[13px]"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
                <input
                  className="rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[10px] py-[8px] text-[13px]"
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </div>
            )}

            <Button onClick={generateInsights} disabled={isGenerating || currentIntegration?.identifier !== 'x'}>
              {isGenerating ? 'Generating...' : 'Generate Growth Insights'}
            </Button>

            {currentIntegration?.identifier !== 'x' && (
              <div className="rounded-[12px] border border-newTableBorder bg-newBgColorInner px-[14px] py-[12px] text-[13px] text-newTableText/70">
                Growth Intelligence currently supports X provider first. The backend is provider-aware for future platforms.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-[14px] xl:grid-cols-3">
        <div className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
          <div className="text-[15px] font-medium text-newTableText">Best time to post</div>
          <div className="mt-[6px] text-[12px] text-newTableText/50">Analytics-based slots for the selected period.</div>
          {bestTimes?.status === 'insufficient_data' ? (
            <div className="mt-[14px] rounded-[12px] bg-newBgColorInner p-[12px] text-[13px] text-newTableText/65">
              Need at least {bestTimes.minimumPosts} posts. Current sample: {bestTimes.postsAnalyzed}.
            </div>
          ) : bestTimes?.slots?.length ? (
            <div className="mt-[14px] flex flex-col gap-[8px]">
              {bestTimes.slots.slice(0, 5).map((slot) => (
                <div key={`${slot.dayOfWeek}-${slot.hour}`} className="flex items-center justify-between rounded-[12px] bg-newBgColorInner px-[12px] py-[10px]">
                  <div className="text-[13px] font-medium text-newTableText">
                    {weekdayLabel[slot.dayOfWeek]} {String(slot.hour).padStart(2, '0')}:00 UTC
                  </div>
                  <div className="text-[12px] text-newTableText/60">
                    {formatPercent(slot.avgEngagementRate)} · {slot.sampleSize} posts
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-[14px] text-[13px] text-newTableText/55">No slot data yet.</div>
          )}
        </div>

        <div className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
          <div className="text-[15px] font-medium text-newTableText">Engagement trend</div>
          <div className="mt-[6px] text-[12px] text-newTableText/50">Daily average engagement rate.</div>
          {engagementSeries?.points?.length ? (
            <div className="mt-[14px] flex h-[150px] items-end gap-[5px] rounded-[12px] bg-newBgColorInner p-[12px]">
              {engagementSeries.points.slice(-24).map((point) => {
                const max = Math.max(...engagementSeries.points.map((item) => item.avgEngagementRate), 0.001);
                return (
                  <div key={point.date} className="flex flex-1 flex-col items-center gap-[6px]">
                    <div
                      className="w-full rounded-t-[6px] bg-[#612bd3]"
                      style={{ height: `${Math.max(4, (point.avgEngagementRate / max) * 110)}px` }}
                      title={`${point.date}: ${formatPercent(point.avgEngagementRate)}`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-[14px] text-[13px] text-newTableText/55">No engagement series yet.</div>
          )}
        </div>

        <div className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
          <div className="text-[15px] font-medium text-newTableText">Top content types</div>
          <div className="mt-[6px] text-[12px] text-newTableText/50">Best formats by average engagement.</div>
          {contentTypes?.items?.length ? (
            <div className="mt-[14px] flex flex-col gap-[8px]">
              {contentTypes.items.slice(0, 5).map((item) => (
                <div key={item.format} className="rounded-[12px] bg-newBgColorInner p-[12px]">
                  <div className="flex items-center justify-between gap-[10px]">
                    <div className="text-[13px] font-medium capitalize text-newTableText">{item.format}</div>
                    <div className="text-[12px] text-newTableText/60">{formatPercent(item.avgEngagementRate)}</div>
                  </div>
                  <div className="mt-[5px] text-[12px] text-newTableText/50">{item.posts} posts analyzed</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-[14px] text-[13px] text-newTableText/55">No content type data yet.</div>
          )}
        </div>
      </section>

      {isLoadingLatestInsight ? (
        <div className="flex justify-center rounded-[18px] border border-newTableBorder bg-newTableHeader py-[40px]">
          <LoadingComponent />
        </div>
      ) : latestInsightError ? (
        <div className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[24px] text-center text-newTableText/70">
          Failed to load the latest insight.
          <div className="mt-[12px]">
            <Button onClick={() => mutateLatestInsight()}>Retry</Button>
          </div>
        </div>
      ) : !insight ? (
        <div className="rounded-[18px] border border-dashed border-newTableBorder bg-newTableHeader p-[24px] text-center text-newTableText/70">
          Generate growth insights from the selected account to get a diagnosis, recommendations, and reusable templates.
        </div>
      ) : (
        <div className="flex flex-col gap-[18px]">
          <section className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
            <div className="text-[15px] font-medium text-newTableText">Diagnosis cards</div>
            <div className="mt-[12px] grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(insight.diagnosis).map(([key, value]) => (
                <div key={key} className="rounded-[14px] bg-newBgColorInner p-[14px]">
                  <div className="text-[12px] capitalize text-newTableText/50">{formatLabel(key)}</div>
                  <div className="mt-[6px] text-[16px] font-medium capitalize text-newTableText">
                    {formatMetricValue(value)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
            <div className="text-[15px] font-medium text-newTableText">Account growth summary</div>
            <p className="mt-[8px] text-[14px] leading-6 text-newTableText/75">{insight.summary}</p>

            <div className="mt-[12px] grid gap-[12px] md:grid-cols-4">
              <div className="rounded-[14px] bg-newBgColorInner p-[14px]">
                <div className="text-[12px] text-newTableText/50">Posts analyzed</div>
                <div className="mt-[6px] text-[15px] font-medium text-newTableText">
                  {insight.sourceStats.postsAnalyzed.toLocaleString()}
                </div>
              </div>
              <div className="rounded-[14px] bg-newBgColorInner p-[14px]">
                <div className="text-[12px] text-newTableText/50">Snapshots used</div>
                <div className="mt-[6px] text-[15px] font-medium text-newTableText">
                  {insight.sourceStats.snapshotsUsed.toLocaleString()}
                </div>
              </div>
              <div className="rounded-[14px] bg-newBgColorInner p-[14px]">
                <div className="text-[12px] text-newTableText/50">Metrics fetched</div>
                <div className="mt-[6px] text-[15px] font-medium text-newTableText">
                  {insight.sourceStats.metricsFetched.toLocaleString()}
                </div>
              </div>
              <div className="rounded-[14px] bg-newBgColorInner p-[14px]">
                <div className="text-[12px] text-newTableText/50">Period days</div>
                <div className="mt-[6px] text-[15px] font-medium text-newTableText">{insight.period.days}</div>
              </div>
            </div>
          </section>

          {!!insight.contentPatterns.length && (
            <section className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
              <div className="text-[15px] font-medium text-newTableText">Content pattern evidence</div>
              <div className="mt-[12px] grid grid-cols-1 gap-[12px] lg:grid-cols-2">
                {insight.contentPatterns.map((pattern) => (
                  <div key={pattern.pattern} className="rounded-[14px] border border-newTableBorder bg-newBgColorInner p-[14px]">
                    <div className="text-[14px] font-medium text-newTableText">{pattern.pattern}</div>
                    <div className="mt-[6px] text-[13px] leading-6 text-newTableText/65">{pattern.evidence}</div>
                    <div className="mt-[6px] text-[12px] text-newTableText/50">{pattern.impact}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
            <div className="text-[15px] font-medium text-newTableText">Recommendations</div>
            <div className="mt-[12px] flex flex-col gap-[10px]">
              {insight.recommendations.map((recommendation) => (
                <div key={`${recommendation.type}-${recommendation.message}`} className="rounded-[14px] border border-newTableBorder bg-newBgColorInner p-[14px]">
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <span className={`rounded-full border px-[8px] py-[3px] text-[11px] font-medium ${priorityTone[recommendation.priority]}`}>
                      {recommendation.priority}
                    </span>
                    <span className="text-[14px] font-medium text-newTableText">{recommendation.message}</span>
                  </div>
                  <div className="mt-[7px] text-[13px] leading-6 text-newTableText/65">{recommendation.reason}</div>
                  <div className="mt-[5px] text-[12px] text-newTableText/50">Expected impact: {recommendation.expectedImpact}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
            <div className="text-[15px] font-medium text-newTableText">Fillable content templates</div>
            <div className="mt-[12px] grid grid-cols-1 gap-[12px] xl:grid-cols-2">
              {insight.templates.map((template) => (
                <div key={`${template.type}-${template.title}`} className="rounded-[14px] border border-newTableBorder bg-newBgColorInner p-[14px]">
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <div className="text-[14px] font-medium text-newTableText">{template.title}</div>
                    <span className="rounded-full border border-newTableBorder px-[8px] py-[3px] text-[11px] text-newTableText/50">
                      {formatLabel(template.source || 'approved_library')}
                    </span>
                  </div>
                  <pre className="mt-[10px] whitespace-pre-wrap rounded-[10px] bg-newTableHeader p-[12px] text-[13px] leading-6 text-newTableText/80">
                    {template.template}
                  </pre>
                  <div className="mt-[8px] text-[12px] text-newTableText/50">{template.useCase}</div>
                  <div className="mt-[4px] text-[12px] text-newTableText/50">Reason: {template.reason}</div>
                  <div className="mt-[12px] flex flex-wrap gap-[8px]">
                    <button
                      className="rounded-[8px] bg-[#612bd3] px-[12px] py-[7px] text-[12px] font-medium text-white"
                      onClick={() => copyTemplate(template.template)}
                    >
                      Copy
                    </button>
                    <button
                      className="rounded-[8px] border border-newTableBorder px-[12px] py-[7px] text-[12px] font-medium text-newTableText"
                      onClick={() => saveTemplate(template, insight.id)}
                    >
                      Save preset
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {!!insight.dailySuggestions?.length && (
            <section className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-medium text-newTableText">Daily Suggested Posts Calendar</div>
                  <div className="mt-[4px] text-[12px] text-newTableText/50">
                    Your step-by-step growth path tailored for the {formatLabel(insight.niche || niche)} niche.
                  </div>
                </div>
                <div className="rounded-full bg-[#612bd3]/10 border border-[#612bd3]/30 px-[10px] py-[3px] text-[11px] font-medium text-[#612bd3] capitalize">
                  Goal: {insight.growthGoal === '5_days' ? '5 Days Plan' : 'Weekly Plan'}
                </div>
              </div>

              <div className="mt-[14px] flex flex-col gap-[14px]">
                {insight.dailySuggestions.map((suggestion) => (
                  <div key={suggestion.dayNumber} className="rounded-[14px] border border-newTableBorder bg-newBgColorInner p-[14px]">
                    <div className="flex flex-wrap items-center justify-between gap-[10px]">
                      <div className="flex items-center gap-[8px]">
                        <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[#612bd3] text-[11px] font-bold text-white">
                          {suggestion.dayNumber}
                        </span>
                        <span className="text-[14px] font-semibold text-newTableText">{suggestion.title}</span>
                      </div>
                      <div className="flex items-center gap-[8px]">
                        <span className="rounded-md border border-newTableBorder bg-newTableHeader px-[8px] py-[3px] text-[11px] font-medium text-newTableText/70 capitalize">
                          {formatLabel(suggestion.focus)}
                        </span>
                        <span className="text-[12px] text-newTableText/40 font-medium">
                          {dayjs(suggestion.date).format('MMM D, YYYY')} @ {suggestion.scheduledTime}
                        </span>
                      </div>
                    </div>

                    <pre className="mt-[10px] whitespace-pre-wrap rounded-[10px] bg-newTableHeader p-[12px] text-[13px] leading-6 text-newTableText/85 italic border border-newTableBorder/30">
                      {suggestion.suggestedContent}
                    </pre>

                    <div className="mt-[8px] text-[12px] leading-5 text-newTableText/60">
                      <span className="font-semibold text-newTableText/80">Strategy logic:</span> {suggestion.reason}
                    </div>

                    <div className="mt-[12px] flex items-center justify-between">
                      <div className="text-[11px] font-medium text-[#32d583] flex items-center gap-[4px]">
                        <svg className="h-[14px] w-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Editable Draft
                      </div>
                      <button
                        className="rounded-[8px] bg-[#612bd3] px-[14px] py-[8px] text-[12px] font-semibold text-white hover:bg-[#5223b5] transition-colors flex items-center gap-[6px] shadow-sm"
                        onClick={() => scheduleSuggestedPost(suggestion.suggestedContent, suggestion.scheduledAt)}
                      >
                        <svg className="h-[14px] w-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Schedule Post
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(insightHistory.length > 0 || !!insightHistoryError) && (
            <section className="rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
              <div className="flex items-center justify-between gap-[10px]">
                <div>
                  <div className="text-[15px] font-medium text-newTableText">Insight history</div>
                  <div className="mt-[4px] text-[13px] text-newTableText/60">
                    Previous growth analyses for this account.
                  </div>
                </div>
                {isLoadingHistory && <div className="text-[12px] text-newTableText/50">Refreshing...</div>}
              </div>

              {insightHistoryError && (
                <div className="mt-[12px] rounded-[14px] border border-newTableBorder bg-newBgColorInner p-[14px] text-[13px] text-newTableText/70">
                  Failed to load insight history.
                </div>
              )}

              <div className="mt-[12px] grid grid-cols-1 gap-[12px] lg:grid-cols-2">
                {insightHistory.map((item) => (
                  <div key={item.id} className="rounded-[14px] border border-newTableBorder bg-newBgColorInner p-[14px]">
                    <div className="flex flex-wrap items-center justify-between gap-[8px]">
                      <div className="text-[14px] font-medium text-newTableText">
                        {dayjs(item.createdAt).format('MMM D, YYYY')}
                      </div>
                      <div className="rounded-full border border-newTableBorder px-[8px] py-[3px] text-[11px] text-newTableText/60">
                        {item.period.days} days
                      </div>
                    </div>
                    <div className="mt-[8px] text-[13px] leading-6 text-newTableText/65">{item.summary}</div>
                    <div className="mt-[8px] text-[12px] text-newTableText/50">
                      {item.period.from} to {item.period.to}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
