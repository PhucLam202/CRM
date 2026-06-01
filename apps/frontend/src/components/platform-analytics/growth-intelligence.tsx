'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { Select } from '@gitroom/react/form/select';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useToaster } from '@gitroom/react/toaster/toaster';

interface AnalyticsIntegration {
  id: string;
  identifier: string;
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
}

interface ContentPattern {
  pattern: string;
  evidence: string;
  impact: string;
  strength: number;
}

interface GrowthInsight {
  id: string;
  period: {
    from: string;
    to: string;
    days: number;
  };
  sourceStats: {
    postsAnalyzed: number;
    snapshotsUsed: number;
    metricsFetched: number;
    fromDatabase: boolean;
  };
  summary: string;
  diagnosis: Record<string, string>;
  contentPatterns: ContentPattern[];
  recommendations: GrowthRecommendation[];
  templates: GrowthTemplate[];
  scoreBreakdown: Record<string, number | string>;
  createdAt: string;
}

const priorityTone: Record<GrowthRecommendation['priority'], string> = {
  high: 'border-[#f97066]/40 bg-[#f97066]/10 text-[#f97066]',
  medium: 'border-[#fdb022]/40 bg-[#fdb022]/10 text-[#fdb022]',
  low: 'border-[#32d583]/40 bg-[#32d583]/10 text-[#32d583]',
};

export const GrowthIntelligence: FC<{ integration: AnalyticsIntegration }> = ({ integration }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const [range, setRange] = useState('7');
  const [customFrom, setCustomFrom] = useState(dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [customTo, setCustomTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [isGenerating, setIsGenerating] = useState(false);

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

  const loadLatest = useCallback(async () => {
    const response = await fetch(`/analytics/${integration.id}/growth-insights/latest`);
    if (!response.ok) {
      throw new Error('Failed to load growth insight');
    }

    return (await response.json()) as GrowthInsight | null;
  }, [fetch, integration.id]);

  const { data, isLoading, mutate } = useSWR(
    `/analytics-${integration.id}-growth-insights-latest`,
    loadLatest,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/analytics/${integration.id}/growth-insights/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...period, forceRefresh: false }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to generate growth insight');
      }

      const insight = (await response.json()) as GrowthInsight;
      await mutate(insight, false);
      toaster.show('Growth insight generated', 'success');
    } catch (error) {
      toaster.show(error instanceof Error ? error.message : 'Failed to generate growth insight', 'warning');
    } finally {
      setIsGenerating(false);
    }
  }, [fetch, integration.id, mutate, period, toaster]);

  const saveTemplate = useCallback(
    async (template: GrowthTemplate, insightId: string) => {
      const response = await fetch(`/analytics/${integration.id}/content-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...template, sourceInsightId: insightId }),
      });

      toaster.show(response.ok ? 'Template saved' : 'Failed to save template', response.ok ? 'success' : 'warning');
    },
    [fetch, integration.id, toaster]
  );

  const copyTemplate = useCallback(
    async (template: string) => {
      await navigator.clipboard.writeText(template);
      toaster.show('Template copied', 'success');
    },
    [toaster]
  );

  return (
    <section className="mt-[24px] rounded-[18px] border border-newTableBorder bg-newTableHeader p-[18px] shadow-sm">
      <div className="flex flex-col gap-[14px] lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[20px] font-semibold text-newTableText">Growth Intelligence</div>
          <div className="mt-[4px] text-[13px] text-newTableText/60">
            Analyze why performance changed and get reusable content templates for {integration.name}.
          </div>
        </div>
        <div className="flex flex-col gap-[10px] sm:flex-row sm:items-end">
          <div className="min-w-[150px]">
            <Select label="" name="growthRange" value={range} disableForm={true} hideErrors={true} onChange={(event) => setRange(event.target.value)}>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="custom">Custom</option>
            </Select>
          </div>
          {range === 'custom' && (
            <div className="flex gap-[8px]">
              <input className="rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[10px] py-[8px] text-[13px]" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
              <input className="rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[10px] py-[8px] text-[13px]" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
            </div>
          )}
          <Button onClick={generate} disabled={isGenerating || integration.identifier !== 'x'}>
            {isGenerating ? 'Generating...' : 'Generate Growth Insights'}
          </Button>
        </div>
      </div>

      {integration.identifier !== 'x' && (
        <div className="mt-[16px] rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[14px] text-[13px] text-newTableText/70">
          Growth Intelligence currently supports X provider first. The backend is provider-aware for future platforms.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-[36px]"><LoadingComponent /></div>
      ) : !data ? (
        <div className="mt-[16px] rounded-[14px] border border-dashed border-newTableBorder bg-newBgColorInner p-[24px] text-center text-newTableText/70">
          Generate growth insights from your real account analytics. Results will be saved and shown here.
        </div>
      ) : (
        <div className="mt-[18px] flex flex-col gap-[18px]">
          <div className="grid grid-cols-1 gap-[12px] md:grid-cols-4">
            {Object.entries(data.diagnosis).map(([key, value]) => (
              <div key={key} className="rounded-[12px] bg-newBgColorInner p-[12px]">
                <div className="text-[12px] capitalize text-newTableText/50">{key.replace(/([A-Z])/g, ' $1')}</div>
                <div className="mt-[4px] text-[16px] font-medium capitalize text-newTableText">{value.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>

          <div className="rounded-[14px] bg-newBgColorInner p-[16px]">
            <div className="text-[14px] font-medium text-newTableText">Account Growth Summary</div>
            <p className="mt-[8px] text-[14px] leading-6 text-newTableText/75">{data.summary}</p>
            <div className="mt-[10px] text-[12px] text-newTableText/50">
              Analyzed {data.sourceStats.postsAnalyzed} posts. Used {data.sourceStats.snapshotsUsed} DB snapshots and fetched {data.sourceStats.metricsFetched} missing/stale metrics.
            </div>
          </div>

          {!!data.contentPatterns.length && (
            <div>
              <div className="mb-[10px] text-[15px] font-medium text-newTableText">Content Pattern Analysis</div>
              <div className="grid grid-cols-1 gap-[12px] lg:grid-cols-2">
                {data.contentPatterns.map((pattern) => (
                  <div key={pattern.pattern} className="rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[14px]">
                    <div className="text-[14px] font-medium text-newTableText">{pattern.pattern}</div>
                    <div className="mt-[6px] text-[13px] text-newTableText/65">{pattern.evidence}</div>
                    <div className="mt-[6px] text-[12px] text-newTableText/50">{pattern.impact}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-[10px] text-[15px] font-medium text-newTableText">Growth Recommendations</div>
            <div className="flex flex-col gap-[10px]">
              {data.recommendations.map((recommendation) => (
                <div key={`${recommendation.type}-${recommendation.message}`} className="rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[14px]">
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <span className={`rounded-full border px-[8px] py-[3px] text-[11px] font-medium ${priorityTone[recommendation.priority]}`}>{recommendation.priority}</span>
                    <span className="text-[14px] font-medium text-newTableText">{recommendation.message}</span>
                  </div>
                  <div className="mt-[7px] text-[13px] text-newTableText/65">{recommendation.reason}</div>
                  <div className="mt-[5px] text-[12px] text-newTableText/50">Expected impact: {recommendation.expectedImpact}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-[10px] text-[15px] font-medium text-newTableText">Fillable Content Templates</div>
            <div className="grid grid-cols-1 gap-[12px] xl:grid-cols-2">
              {data.templates.map((template) => (
                <div key={`${template.type}-${template.title}`} className="rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[14px]">
                  <div className="text-[14px] font-medium text-newTableText">{template.title}</div>
                  <pre className="mt-[10px] whitespace-pre-wrap rounded-[10px] bg-newTableHeader p-[12px] text-[13px] leading-6 text-newTableText/80">{template.template}</pre>
                  <div className="mt-[8px] text-[12px] text-newTableText/50">{template.useCase}</div>
                  <div className="mt-[4px] text-[12px] text-newTableText/50">Reason: {template.reason}</div>
                  <div className="mt-[12px] flex gap-[8px]">
                    <button className="rounded-[8px] bg-[#612bd3] px-[12px] py-[7px] text-[12px] font-medium text-white" onClick={() => copyTemplate(template.template)}>Copy</button>
                    <button className="rounded-[8px] border border-newTableBorder px-[12px] py-[7px] text-[12px] font-medium text-newTableText" onClick={() => saveTemplate(template, data.id)}>Save template</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
