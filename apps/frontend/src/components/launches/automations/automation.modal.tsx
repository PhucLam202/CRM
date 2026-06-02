'use client';

import { FC, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import dayjs from 'dayjs';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { Select } from '@gitroom/react/form/select';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  AutomationTab,
  CampaignItem,
  CONTENT_AUTOMATION_FORMATS,
  ContentAutomationFormat,
  ContentAutomationItem,
  EvergreenItem,
  FORMAT_LABELS,
  GOAL_LABELS,
  IntegrationLite,
  LANGUAGE_LABELS,
  NICHE_LABELS,
} from './automation.types';

const NICHE_OPTIONS = [
  'ai_tech',
  'business_saas',
  'creator_personal_brand',
  'developer_education',
  'fitness_wellness',
  'finance_investing',
  'marketing_growth',
  'design_creators',
] as const;

const GOAL_OPTIONS = ['5_days', '7_days', 'next_week'] as const;
const FORMAT_OPTIONS = CONTENT_AUTOMATION_FORMATS;
const LANGUAGE_OPTIONS = ['en', 'vi'] as const;
const FREQUENCY_OPTIONS = ['daily', 'weekly'] as const;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const estimateRunInterval = (frequencyPerWeek: unknown) => {
  const frequency = Math.max(1, Math.min(14, Number(frequencyPerWeek) || 5));
  const days = Math.max(1, Math.ceil(7 / frequency));
  return days === 1 ? 'about every day' : `about every ${days} days`;
};

interface BaseProps {
  type: AutomationTab;
  editing?: EvergreenItem | ContentAutomationItem | CampaignItem | null;
  integrations: IntegrationLite[];
  contentAutomations?: ContentAutomationItem[];
  onSuccess: () => void;
}

const label = (record: Record<string, string>, key: string) => record[key] || key;

const inputClassName = 'bg-newBgColorInner border-newTableBorder border h-[42px]';

const clampPreferredHour = (value: unknown) => {
  const hour = Number(value);
  if (!Number.isFinite(hour)) return 9;
  return Math.max(0, Math.min(23, hour));
};

const InfoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    className="inline-block align-middle text-textColor/60"
  >
    <path
      d="M7 1.167A5.833 5.833 0 1 0 12.833 7 5.84 5.84 0 0 0 7 1.167Zm0 8.75a.583.583 0 1 1 0-1.167.583.583 0 0 1 0 1.167Zm.583-2.333H6.417v-3.5h1.166v3.5Z"
      fill="currentColor"
    />
  </svg>
);

const LabelWithTooltip: FC<{ label: string; tooltip: string }> = ({ label, tooltip }) => (
  <div className="flex items-center gap-[6px]">
    <span>{label}</span>
    <span data-tooltip-id="tooltip" data-tooltip-content={tooltip} className="cursor-help">
      <InfoIcon />
    </span>
  </div>
);

export const AutomationModal: FC<BaseProps> = ({
  type,
  editing,
  integrations,
  contentAutomations = [],
  onSuccess,
}) => {
  const t = useT();
  const fetch = useFetch();
  const modal = useModals();
  const toaster = useToaster();
  const [saving, setSaving] = useState(false);
  const [publishedPosts, setPublishedPosts] = useState<IntegrationLite[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [posts, setPosts] = useState<Array<{ id: string; content: string; integrationId: string }>>([]);

  const activeIntegrations = useMemo(
    () => integrations.filter((i) => !i.disabled),
    [integrations]
  );

  const defaultValues = useMemo(() => {
    if (type === 'evergreen') {
      const e = editing as EvergreenItem | null;
      return {
        integrationId: e?.integrationId || activeIntegrations[0]?.id || '',
        sourcePostId: e?.sourcePostId || '',
        minScore: e?.minScore ?? 0,
        frequencyType: e?.frequencyType || 'weekly',
        frequencyPerWeek: e?.frequencyPerWeek ?? 2,
        nextRepostAt: e?.nextRepostAt
          ? dayjs(e.nextRepostAt).format('YYYY-MM-DDTHH:mm')
          : dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm'),
      };
    }
    if (type === 'content') {
      const e = editing as ContentAutomationItem | null;
      return {
        integrationId: e?.integrationId || activeIntegrations[0]?.id || '',
        niche: e?.niche || 'ai_tech',
        language: e?.language || 'en',
        growthGoal: e?.growthGoal || '5_days',
        format:
          e?.format === ContentAutomationFormat.Thread
            ? ContentAutomationFormat.Thread
            : ContentAutomationFormat.SinglePost,
        frequencyPerWeek: e?.frequencyPerWeek ?? 5,
        preferredHour: e?.preferredHour ?? 9,
        nextRunAt: e?.nextRunAt
          ? dayjs(e.nextRunAt).format('YYYY-MM-DDTHH:mm')
          : dayjs()
              .add(1, 'day')
              .hour(e?.preferredHour ?? 9)
              .minute(0)
              .second(0)
              .millisecond(0)
              .format('YYYY-MM-DDTHH:mm'),
      };
    }
    const e = editing as CampaignItem | null;
    return {
      name: e?.name || '',
      budget: e?.budget ?? 0,
      revenue: e?.revenue ?? 0,
      startDate: e?.startDate
        ? dayjs(e.startDate).format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD'),
      endDate: e?.endDate
        ? dayjs(e.endDate).format('YYYY-MM-DD')
        : dayjs().add(30, 'day').format('YYYY-MM-DD'),
      utmSource: e?.utmSource || '',
      utmMedium: e?.utmMedium || '',
      utmCampaign: e?.utmCampaign || '',
      notes: e?.notes || '',
      postIds: e?.campaignPosts?.map((p) => p.postId) || [],
    };
  }, [type, editing, activeIntegrations]);

  const form = useForm<Record<string, any>>({ defaultValues: defaultValues as any });
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues]);

  const watchIntegrationId = form.watch('integrationId') as string | undefined;
  const watchFrequencyType = (form.watch('frequencyType') as 'daily' | 'weekly') || 'weekly';
  const watchContentIntegrationId = form.watch('integrationId') as string | undefined;
  const watchPreferredHour = form.watch('preferredHour');
  const watchFrequencyPerWeek = form.watch('frequencyPerWeek');
  const watchNextRunAt = form.watch('nextRunAt');

  useEffect(() => {
    if (type !== 'content' || editing) return;

    form.setValue(
      'nextRunAt',
      dayjs()
        .add(1, 'day')
        .hour(clampPreferredHour(watchPreferredHour))
        .minute(0)
        .second(0)
        .millisecond(0)
        .format('YYYY-MM-DDTHH:mm')
    );
  }, [type, editing, watchPreferredHour]);

  const firstRunPreview = useMemo(() => {
    if (type !== 'content') return '';
    return watchNextRunAt ? dayjs(watchNextRunAt).format('DD/MM/YYYY, hh:mm a') : '';
  }, [type, watchNextRunAt]);

  const overlappingAutomation = useMemo(() => {
    if (type !== 'content') return undefined;
    const preferredHour = clampPreferredHour(watchPreferredHour);
    return contentAutomations.find((item) => {
      if (editing && item.id === editing.id) return false;
      return item.active && item.integrationId === watchContentIntegrationId && (item.preferredHour ?? 9) === preferredHour;
    });
  }, [contentAutomations, editing, type, watchContentIntegrationId, watchPreferredHour]);

  useEffect(() => {
    if (type !== 'evergreen') return;
    if (!watchIntegrationId) {
      setPosts([]);
      return;
    }
    let cancelled = false;
    setLoadingPosts(true);
    (async () => {
      try {
        const params = new URLSearchParams({
          display: 'list',
          customer: '',
          state: 'published',
          page: '0',
          limit: '50',
        });
        const res = await (await fetch(`/posts/list?${params.toString()}`)).json();
        const all = (res?.posts || []).flatMap((p: any) => {
          if (p.integration?.id === watchIntegrationId) {
            return [{ id: p.id, content: p.content, integrationId: watchIntegrationId }];
          }
          return [];
        });
        if (!cancelled) setPosts(all);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoadingPosts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, watchIntegrationId]);

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const url = type === 'campaigns' ? '/campaigns' : type === 'content' ? '/content-automations' : '/evergreen';
      const method = editing ? 'PATCH' : 'POST';
      const body = (() => {
        if (type === 'evergreen') {
          const frequencyType = values.frequencyType || 'weekly';
          return {
            integrationId: values.integrationId,
            sourcePostId: values.sourcePostId,
            minScore: Number(values.minScore) || 0,
            frequencyType,
            frequencyPerWeek: Math.max(1, Math.min(14, Number(values.frequencyPerWeek) || 2)),
            nextRepostAt: new Date(values.nextRepostAt).toISOString(),
          };
        }
        if (type === 'content') {
          const preferredHour = clampPreferredHour(values.preferredHour);
          return {
            integrationId: values.integrationId,
            niche: values.niche,
            language: values.language,
            growthGoal: values.growthGoal,
            format: values.format,
            frequencyPerWeek: Math.max(1, Math.min(14, Number(values.frequencyPerWeek) || 5)),
            preferredHour,
            nextRunAt: new Date(values.nextRunAt).toISOString(),
          };
        }
        return {
          name: values.name,
          budget: Number(values.budget) || 0,
          revenue: Number(values.revenue) || 0,
          startDate: new Date(values.startDate).toISOString(),
          endDate: new Date(values.endDate).toISOString(),
          utmSource: values.utmSource || undefined,
          utmMedium: values.utmMedium || undefined,
          utmCampaign: values.utmCampaign || undefined,
          notes: values.notes || undefined,
          postIds: values.postIds || [],
        };
      })();

      const finalUrl = editing ? `${url}/${editing.id}` : url;
      await fetch(finalUrl, { method, body: JSON.stringify(body) });
      toaster.show(
        editing
          ? t('automation_updated', 'Automation updated')
          : t('automation_created', 'Automation created'),
        'success'
      );
      onSuccess();
      modal.closeAll();
    } catch (err: any) {
      toaster.show(
        err?.message || t('automation_save_failed', 'Failed to save automation'),
        'warning'
      );
    } finally {
      setSaving(false);
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} className="flex flex-col gap-[14px] w-full">
        {type === 'evergreen' && (
          <>
            <Select
              label={t('integration', 'Integration')}
              labelTooltip={t(
                'integration_tooltip',
                'Choose the social account that will receive the generated or reposted content.'
              )}
              name="integrationId"
              className={inputClassName}
            >
              {activeIntegrations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.identifier})
                </option>
              ))}
            </Select>
            <div className="flex flex-col gap-[6px]">
              <div className="text-[14px] flex items-center gap-[6px]">
                <span>{t('source_post', 'Source post to repost')}</span>
              </div>
              {loadingPosts ? (
                <div className="h-[80px] flex items-center justify-center">
                  <LoadingComponent />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-[13px] text-textColor/70 py-[10px]">
                  {t(
                    'evergreen_no_published_posts',
                    'No published posts found for this integration yet.'
                  )}
                </div>
              ) : (
                <select
                  {...form.register('sourcePostId')}
                  className="h-[80px] bg-newBgColorInner px-[12px] py-[8px] outline-none border-newTableBorder border rounded-[8px] text-[14px]"
                >
                  {posts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.content.slice(0, 80) || '(no content)'}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              <div className="flex flex-col gap-[6px]">
                <div className="text-[14px]">
                  <LabelWithTooltip
                    label={t('min_score', 'Min engagement score (0-1)')}
                    tooltip={t(
                      'min_score_tooltip',
                      'Only repost posts that are above this engagement threshold. 0 means no filter, 1 means only the strongest posts.'
                    )}
                  />
                </div>
                <div className={`bg-newBgColorInner border-newTableBorder border rounded-[8px] h-[42px] flex items-center`}>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    {...form.register('minScore')}
                    className="h-full bg-transparent outline-none flex-1 text-[14px] text-textColor px-[16px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-[10px] items-start">
                <Select
                  label={t('frequency_type', 'Frequency type')}
                  labelTooltip={t(
                    'frequency_type_tooltip',
                    'Select the time window the cap applies to: Daily or Weekly.'
                  )}
                  name="frequencyType"
                  className={inputClassName}
                >
                  {FREQUENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'daily' ? t('daily', 'Daily') : t('weekly', 'Weekly')}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={14}
                  label={t(
                    'frequency_count',
                    watchFrequencyType === 'daily' ? 'Posts per day' : 'Posts per week'
                  )}
                  labelTooltip={t(
                    'frequency_count_tooltip',
                    'How many posts the automation can publish inside the selected period.'
                  )}
                  name="frequencyPerWeek"
                  className={inputClassName}
                />
              </div>
            </div>
            <Input
              type="datetime-local"
              label={t('next_repost_at', 'Next repost at')}
              name="nextRepostAt"
              className={inputClassName}
            />
          </>
        )}

        {type === 'content' && (
          <>
            <div className="rounded-[10px] border border-newTableBorder bg-newBgColorInner p-[12px] text-[13px] text-textColor/75">
              {t(
                'content_automation_form_intro',
                'AI will generate posts for this account using your topic, writing focus, post type, and schedule. Publishing uses the next available optimal slot.'
              )}
            </div>
            <Select
              label={t('social_account', 'Social account')}
              labelTooltip={t(
                'integration_tooltip',
                'Choose the social account that will receive the generated or reposted content.'
              )}
              name="integrationId"
              className={inputClassName}
            >
              {activeIntegrations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.identifier})
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-[10px]">
              <Select
                label={t('topic_niche', 'Topic / niche')}
                labelTooltip={t(
                  'niche_tooltip',
                  'The topic or market segment the AI will write about.'
                )}
                name="niche"
                className={inputClassName}
              >
                {NICHE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {label(NICHE_LABELS, n)}
                  </option>
                ))}
              </Select>
              <Select
                label={t('language', 'Language')}
                labelTooltip={t(
                  'language_tooltip',
                  'The language the AI should use when writing posts.'
                )}
                name="language"
                className={inputClassName}
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {label(LANGUAGE_LABELS, l)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              <Select
                label={t('ai_writing_focus', 'AI writing focus')}
                labelTooltip={t(
                  'growth_goal_tooltip',
                  'This guides how the AI writes. Quick engagement favors short, punchy posts. Consistent growth balances value and engagement. Weekly planning creates more planned, insight-led posts.'
                )}
                name="growthGoal"
                className={inputClassName}
              >
                {GOAL_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {label(GOAL_LABELS, g)}
                  </option>
                ))}
              </Select>
              <Select
                label={t('post_type', 'Post type')}
                labelTooltip={t(
                  'format_tooltip',
                  'Single post creates one standalone post. Thread creates a multi-part post.'
                )}
                name="format"
                className={inputClassName}
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {label(FORMAT_LABELS, f)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              <Input
                type="number"
                min={1}
                max={14}
                label={t('posts_per_week', 'Posts per week')}
                labelTooltip={t(
                  'content_frequency_tooltip',
                  'How many AI-generated posts should be scheduled in one week. Example: 5/week runs roughly every 1-2 days.'
                )}
                name="frequencyPerWeek"
                className={inputClassName}
              />
              <Select
                label={t('automation_run_time', 'Automation run time')}
                labelTooltip={t(
                  'preferred_hour_tooltip',
                  'When the automation checks and generates content. This is not always the final publishing time.'
                )}
                name="preferredHour"
                className={inputClassName}
              >
                {HOUR_OPTIONS.map((hour) => (
                  <option key={hour} value={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="rounded-[10px] border border-newTableBorder bg-newBgColorInner p-[12px] text-[13px] text-textColor/75">
              <div className="font-[500] text-textColor">
                {t('schedule_summary', 'Schedule summary')}
              </div>
              <div>
                {t('schedule_summary_posts', 'Generates')} {Math.max(1, Math.min(14, Number(watchFrequencyPerWeek) || 5))}{' '}
                {t('schedule_summary_posts_suffix', 'posts/week')}, {estimateRunInterval(watchFrequencyPerWeek)}.
              </div>
              <div>
                {t('schedule_summary_run_time', 'Automation runs around')} {formatHour(clampPreferredHour(watchPreferredHour))}.
              </div>
              <div>
                {t(
                  'schedule_summary_publish_slots',
                  'Posts are placed into optimal publishing windows: 07:00-12:00 and 18:00-22:00, with at least 30 minutes between scheduled posts.'
                )}
              </div>
              {firstRunPreview && (
                <div>
                  {editing
                    ? t('next_scheduled_run_preview', 'Next automation run')
                    : t('first_run_preview', 'First automation run')}
                  : {firstRunPreview}
                </div>
              )}
            </div>
            {overlappingAutomation && (
              <div className="rounded-[10px] border border-orange-400/40 bg-orange-400/10 p-[12px] text-[13px] text-orange-200">
                {t(
                  'content_automation_overlap_warning',
                  'Another active automation already runs for this account at this time. Publishing will use the next available slot and may be delayed by 30 minutes or more.'
                )}
              </div>
            )}
            {editing && (
              <Input
                type="datetime-local"
                label={t('next_scheduled_run', 'Next scheduled run')}
                labelTooltip={t(
                  'next_run_tooltip',
                  'Advanced: the exact next time the automation worker runs. Future runs are recalculated from Posts per week and Automation run time.'
                )}
                name="nextRunAt"
                className={inputClassName}
              />
            )}
          </>
        )}

        {type === 'campaigns' && (
          <>
            <Input
              label={t('campaign_name', 'Campaign name')}
              name="name"
              className={inputClassName}
              placeholder="e.g. Black Friday 2025"
            />
            <div className="grid grid-cols-2 gap-[10px]">
              <Input
                type="number"
                min={0}
                step="0.01"
                label={t('budget', 'Budget')}
                name="budget"
                className={inputClassName}
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                label={t('revenue', 'Revenue')}
                name="revenue"
                className={inputClassName}
              />
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              <Input
                type="date"
                label={t('start_date', 'Start date')}
                name="startDate"
                className={inputClassName}
              />
              <Input
                type="date"
                label={t('end_date', 'End date')}
                name="endDate"
                className={inputClassName}
              />
            </div>
            <div className="grid grid-cols-3 gap-[10px]">
              <Input
                label="utm_source"
                name="utmSource"
                className={inputClassName}
                placeholder="x"
              />
              <Input
                label="utm_medium"
                name="utmMedium"
                className={inputClassName}
                placeholder="social"
              />
              <Input
                label="utm_campaign"
                name="utmCampaign"
                className={inputClassName}
                placeholder="bf2025"
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <div className="text-[14px]">{t('notes', 'Notes')}</div>
              <textarea
                {...form.register('notes')}
                rows={3}
                className="bg-newBgColorInner border-newTableBorder border rounded-[8px] p-[12px] outline-none text-[14px] text-textColor"
                placeholder={t('campaign_notes_hint', 'Tracking notes, links, etc.')}
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-[10px] pt-[8px] border-t border-tableBorder">
          <Button
            type="button"
            onClick={() => modal.closeAll()}
            className="bg-transparent border border-tableBorder text-textColor"
          >
            {t('cancel', 'Cancel')}
          </Button>
          <Button type="submit" loading={saving}>
            {editing
              ? t('save_changes', 'Save changes')
              : t('create', 'Create')}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};
