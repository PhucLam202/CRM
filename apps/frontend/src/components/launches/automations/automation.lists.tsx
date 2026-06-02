'use client';

import { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { Button } from '@gitroom/react/form/button';
import { AutomationModal } from './automation.modal';
import {
  CampaignItem,
  ContentAutomationItem,
  EvergreenItem,
  FORMAT_LABELS,
  GOAL_LABELS,
  IntegrationLite,
  LANGUAGE_LABELS,
  NICHE_LABELS,
} from './automation.types';

interface CommonProps {
  integrations: IntegrationLite[];
}

const label = (record: Record<string, string>, key: string) => record[key] || key;

const formatDate = (value?: string | null) =>
  value ? dayjs(value).format('MMM D, HH:mm') : '-';

const periodLabel = (type: 'daily' | 'weekly') => (type === 'daily' ? '/day' : '/week');

const timeUntil = (value?: string | null) => {
  if (!value) return 'n/a';
  const target = dayjs(value);
  const now = dayjs();
  const diffMinutes = target.diff(now, 'minute');

  if (diffMinutes <= 0) return 'due now';
  if (diffMinutes < 60) return `in ${diffMinutes}m`;

  const diffHours = target.diff(now, 'hour');
  if (diffHours < 24) return `in ${diffHours}h`;

  const diffDays = target.diff(now, 'day');
  return `in ${diffDays}d`;
};

const useAutomationList = <T,>(path: string) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (await fetch(path)).json()) as T[];
  }, [path]);
  const { data, isLoading, mutate } = useSWR<T[]>(path, load, {
    revalidateOnFocus: false,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
  return { data: data || [], isLoading, mutate };
};

const ActionButton: FC<{
  onClick: () => void;
  variant?: 'default' | 'danger' | 'subtle';
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ onClick, variant = 'subtle', children, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      'h-[30px] px-[10px] rounded-[6px] text-[12px] font-[500] transition-all',
      variant === 'danger' && 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
      variant === 'default' && 'bg-btnPrimary text-white hover:opacity-90',
      variant === 'subtle' && 'bg-newBgLineColor text-textColor hover:bg-boxFocused',
      disabled && 'opacity-50 pointer-events-none'
    )}
  >
    {children}
  </button>
);

const StatusBadge: FC<{ active: boolean }> = ({ active }) => (
  <span
    className={clsx(
      'inline-flex items-center gap-[6px] text-[12px] px-[8px] py-[2px] rounded-full',
      active
        ? 'bg-emerald-500/15 text-emerald-400'
        : 'bg-newBgLineColor text-textColor/60'
    )}
  >
    <span
      className={clsx(
        'w-[6px] h-[6px] rounded-full',
        active ? 'bg-emerald-400' : 'bg-textColor/40'
      )}
    />
    {active ? 'Active' : 'Paused'}
  </span>
);

const integrationName = (
  integrations: IntegrationLite[],
  id: string
) => integrations.find((i) => i.id === id)?.name || id;

export const EvergreenList: FC<CommonProps> = ({ integrations }) => {
  const t = useT();
  const fetch = useFetch();
  const modal = useModals();
  const toaster = useToaster();
  const { data, isLoading, mutate } = useAutomationList<EvergreenItem>('/evergreen');

  const openCreate = useCallback(() => {
    modal.openModal({
      title: t('create_evergreen', 'New Evergreen Repost'),
      withCloseButton: true,
      children: (
        <AutomationModal
          type="evergreen"
          integrations={integrations}
          onSuccess={() => mutate()}
        />
      ),
      size: 600,
    });
  }, [data, integrations, mutate]);

  const openEdit = useCallback(
    (item: EvergreenItem) => () => {
      modal.openModal({
        title: t('edit_evergreen', 'Edit Evergreen Repost'),
        withCloseButton: true,
        children: (
          <AutomationModal
            type="evergreen"
            editing={item}
            integrations={integrations}
            onSuccess={() => mutate()}
          />
        ),
        size: 600,
      });
    },
    [data, integrations, mutate]
  );

  const toggleActive = useCallback(
    (item: EvergreenItem) => async () => {
      try {
        await fetch(`/evergreen/${item.id}/${item.active ? 'pause' : 'resume'}`, {
          method: 'POST',
        });
        toaster.show(
          item.active
            ? t('evergreen_paused', 'Evergreen paused')
            : t('evergreen_resumed', 'Evergreen resumed'),
          'success'
        );
        mutate();
      } catch {
        toaster.show(t('action_failed', 'Action failed'), 'warning');
      }
    },
    [fetch, mutate, t, toaster]
  );

  const remove = useCallback(
    (item: EvergreenItem) => async () => {
      try {
        await fetch(`/evergreen/${item.id}`, { method: 'DELETE' });
        toaster.show(t('evergreen_deleted', 'Evergreen deleted'), 'success');
        mutate();
      } catch {
        toaster.show(t('delete_failed', 'Delete failed'), 'warning');
      }
    },
    [fetch, mutate, t, toaster]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-[60px]">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[20px] font-[600]">
            {t('evergreen_title', 'Evergreen Repost')}
          </div>
          <div className="text-[13px] text-textColor/70">
            {t(
              'evergreen_description',
              'Automatically re-share your best-performing posts on a weekly schedule.'
            )}
          </div>
        </div>
        <Button onClick={openCreate}>+ {t('new_evergreen', 'New repost')}</Button>
      </div>
      {data.length === 0 ? (
        <div className="bg-newBgColorInner border border-newTableBorder rounded-[10px] py-[40px] text-center text-textColor/60">
          {t('evergreen_empty', 'No evergreen reposts yet. Click "New repost" to start.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[12px]">
          {data.map((item) => (
            <div
              key={item.id}
              className="bg-newBgColorInner border border-newTableBorder rounded-[10px] p-[14px] flex flex-col gap-[10px]"
            >
              <div className="flex items-start justify-between gap-[8px]">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-[500] truncate">
                    {integrationName(integrations, item.integrationId)}
                  </div>
                  <div className="text-[12px] text-textColor/60 truncate">
                    Source: {item.sourcePostId.slice(0, 8)}…
                  </div>
                </div>
                <StatusBadge active={item.active} />
              </div>
              <div className="grid grid-cols-2 gap-[8px] text-[12px]">
                <div className="flex flex-col">
                  <span className="text-textColor/60">Frequency</span>
                  <span>{item.frequencyPerWeek}{periodLabel(item.frequencyType)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-textColor/60">Min score</span>
                  <span>{item.minScore.toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-textColor/60">Next repost</span>
                  <span>{formatDate(item.nextRepostAt)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-textColor/60">Rotated</span>
                  <span>{item.rotationCount}×</span>
                </div>
              </div>
              <div className="flex gap-[6px] pt-[6px] border-t border-tableBorder">
                <ActionButton onClick={openEdit(item)}>Edit</ActionButton>
                <ActionButton onClick={toggleActive(item)}>
                  {item.active ? 'Pause' : 'Resume'}
                </ActionButton>
                <ActionButton onClick={remove(item)} variant="danger">
                  Delete
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ContentAutomationList: FC<CommonProps> = ({ integrations }) => {
  const t = useT();
  const fetch = useFetch();
  const modal = useModals();
  const toaster = useToaster();
  const { data, isLoading, mutate } =
    useAutomationList<ContentAutomationItem>('/content-automations');

  const openCreate = useCallback(() => {
    modal.openModal({
      title: t('create_content_automation', 'Create AI Content Automation'),
      withCloseButton: true,
      children: (
        <AutomationModal
          type="content"
          integrations={integrations}
          contentAutomations={data}
          onSuccess={() => mutate()}
        />
      ),
      size: 680,
    });
  }, [integrations, mutate]);

  const openEdit = useCallback(
    (item: ContentAutomationItem) => () => {
      modal.openModal({
        title: t('edit_content_automation', 'Edit AI Content Automation'),
        withCloseButton: true,
        children: (
          <AutomationModal
            type="content"
            editing={item}
            integrations={integrations}
            contentAutomations={data}
            onSuccess={() => mutate()}
          />
        ),
        size: 680,
      });
    },
    [integrations, mutate]
  );

  const toggleActive = useCallback(
    (item: ContentAutomationItem) => async () => {
      try {
        await fetch(`/content-automations/${item.id}/${item.active ? 'pause' : 'resume'}`, {
          method: 'POST',
        });
        toaster.show(
          item.active
            ? t('content_automation_paused', 'Content automation paused')
            : t('content_automation_resumed', 'Content automation resumed'),
          'success'
        );
        mutate();
      } catch {
        toaster.show(t('action_failed', 'Action failed'), 'warning');
      }
    },
    [fetch, mutate, t, toaster]
  );

  const remove = useCallback(
    (item: ContentAutomationItem) => async () => {
      try {
        await fetch(`/content-automations/${item.id}`, { method: 'DELETE' });
        toaster.show(
          t('content_automation_deleted', 'Content automation deleted'),
          'success'
        );
        mutate();
      } catch {
        toaster.show(t('delete_failed', 'Delete failed'), 'warning');
      }
    },
    [fetch, mutate, t, toaster]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-[60px]">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[20px] font-[600]">
            {t('content_automation_title', 'Content Automation')}
          </div>
          <div className="text-[13px] text-textColor/70">
            {t(
              'content_automation_description',
              'AI writes posts for your chosen topic and schedules them into optimal posting windows.'
            )}
          </div>
        </div>
        <Button onClick={openCreate}>
          + {t('new_content_automation', 'New automation')}
        </Button>
      </div>
      {data.length === 0 ? (
        <div className="bg-newBgColorInner border border-newTableBorder rounded-[10px] py-[40px] text-center text-textColor/60">
          {t(
            'content_automation_empty',
            'No content automations yet. Click "New automation" to start.'
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[12px]">
          {data.map((item) => (
            <div
              key={item.id}
              className="bg-newBgColorInner border border-newTableBorder rounded-[10px] p-[14px] flex flex-col gap-[10px]"
            >
              <div className="flex items-start justify-between gap-[8px]">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-[500] truncate">
                    {label(NICHE_LABELS, item.niche)}
                  </div>
                  <div className="text-[12px] text-textColor/60 truncate">
                    → {integrationName(integrations, item.integrationId)}
                  </div>
                </div>
                <StatusBadge active={item.active} />
              </div>
              <div className="grid grid-cols-2 gap-[8px] text-[12px]">
                <div className="flex flex-col">
                  <span className="text-textColor/60">Language</span>
                  <span>{label(LANGUAGE_LABELS, item.language)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-textColor/60">Post type</span>
                  <span>{label(FORMAT_LABELS, item.format)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-textColor/60">Schedule</span>
                  <span>
                    {item.frequencyPerWeek}/week · runs {String(item.preferredHour ?? 9).padStart(2, '0')}:00
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-textColor/60">Total runs</span>
                  <span>{item.totalRuns}</span>
                </div>
              </div>
              <div className="flex flex-col text-[12px] text-textColor/60">
                <span>
                  Next run: {formatDate(item.nextRunAt)} ({timeUntil(item.nextRunAt)})
                </span>
                <span>
                  Last run: {formatDate(item.lastGeneratedAt)}
                </span>
                <span>
                  Focus: {label(GOAL_LABELS, item.growthGoal)}
                </span>
              </div>
              <div className="flex gap-[6px] pt-[6px] border-t border-tableBorder">
                <ActionButton onClick={openEdit(item)}>Edit</ActionButton>
                <ActionButton onClick={toggleActive(item)}>
                  {item.active ? 'Pause' : 'Resume'}
                </ActionButton>
                <ActionButton onClick={remove(item)} variant="danger">
                  Delete
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface CampaignRow extends CampaignItem {
  roi: number | null;
  costPerEngagement: number | null;
}

export const CampaignsList: FC<CommonProps> = ({ integrations }) => {
  const t = useT();
  const fetch = useFetch();
  const modal = useModals();
  const toaster = useToaster();
  const { data, isLoading, mutate } = useAutomationList<CampaignItem>('/campaigns');
  const enriched: CampaignRow[] = useMemo(
    () =>
      data.map((c) => ({
        ...c,
        roi: c.budget > 0 ? (c.revenue - c.budget) / c.budget : null,
        costPerEngagement: null,
      })),
    [data]
  );

  const openCreate = useCallback(() => {
    modal.openModal({
      title: t('create_campaign', 'New Campaign'),
      withCloseButton: true,
      children: (
        <AutomationModal
          type="campaigns"
          integrations={integrations}
          onSuccess={() => mutate()}
        />
      ),
      size: 720,
    });
  }, [integrations, mutate]);

  const openEdit = useCallback(
    (item: CampaignItem) => () => {
      modal.openModal({
        title: t('edit_campaign', 'Edit Campaign'),
        withCloseButton: true,
        children: (
          <AutomationModal
            type="campaigns"
            editing={item}
            integrations={integrations}
            onSuccess={() => mutate()}
          />
        ),
        size: 720,
      });
    },
    [integrations, mutate]
  );

  const openReport = useCallback(
    (item: CampaignItem) => async () => {
      try {
        const report = await (await fetch(`/campaigns/${item.id}/report`)).json();
        const lines = [
          `Name: ${item.name}`,
          `Posts: ${report.totalPosts}`,
          `Engagements: ${report.totalEngagements}`,
          `Impressions: ${report.totalImpressions}`,
          `ROI: ${
            report.roi === null || report.roi === undefined
              ? 'n/a'
              : `${(report.roi * 100).toFixed(1)}%`
          }`,
          `Cost / engagement: ${
            report.costPerEngagement === null || report.costPerEngagement === undefined
              ? 'n/a'
              : report.costPerEngagement.toFixed(2)
          }`,
        ];
        toaster.show(lines.join('\n'), 'success');
      } catch {
        toaster.show(t('report_failed', 'Could not load report'), 'warning');
      }
    },
    [fetch, t, toaster]
  );

  const remove = useCallback(
    (item: CampaignItem) => async () => {
      try {
        await fetch(`/campaigns/${item.id}`, { method: 'DELETE' });
        toaster.show(t('campaign_deleted', 'Campaign deleted'), 'success');
        mutate();
      } catch {
        toaster.show(t('delete_failed', 'Delete failed'), 'warning');
      }
    },
    [fetch, mutate, t, toaster]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-[60px]">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[20px] font-[600]">{t('campaigns_title', 'Campaigns')}</div>
          <div className="text-[13px] text-textColor/70">
            {t(
              'campaigns_description',
              'Track ROI of paid or promo posts using UTM + manual revenue input.'
            )}
          </div>
        </div>
        <Button onClick={openCreate}>+ {t('new_campaign', 'New campaign')}</Button>
      </div>
      {enriched.length === 0 ? (
        <div className="bg-newBgColorInner border border-newTableBorder rounded-[10px] py-[40px] text-center text-textColor/60">
          {t('campaigns_empty', 'No campaigns yet. Click "New campaign" to start.')}
        </div>
      ) : (
        <div className="bg-newBgColorInner border border-newTableBorder rounded-[10px] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-newBgLineColor text-textColor/60 text-[12px]">
              <tr>
                <th className="text-start p-[12px] font-[500]">Name</th>
                <th className="text-start p-[12px] font-[500]">Window</th>
                <th className="text-end p-[12px] font-[500]">Budget</th>
                <th className="text-end p-[12px] font-[500]">Revenue</th>
                <th className="text-end p-[12px] font-[500]">ROI</th>
                <th className="text-end p-[12px] font-[500]">UTM</th>
                <th className="text-end p-[12px] font-[500] w-[180px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((item) => (
                <tr key={item.id} className="border-t border-tableBorder">
                  <td className="p-[12px]">
                    <div className="font-[500]">{item.name}</div>
                    {item.notes && (
                      <div className="text-[11px] text-textColor/60 truncate max-w-[260px]">
                        {item.notes}
                      </div>
                    )}
                  </td>
                  <td className="p-[12px] text-textColor/70">
                    {dayjs(item.startDate).format('MMM D, YYYY')} →{' '}
                    {dayjs(item.endDate).format('MMM D, YYYY')}
                  </td>
                  <td className="p-[12px] text-end">{item.budget.toFixed(2)}</td>
                  <td className="p-[12px] text-end">{item.revenue.toFixed(2)}</td>
                  <td className="p-[12px] text-end">
                    {item.roi === null
                      ? '—'
                      : `${(item.roi * 100).toFixed(1)}%`}
                  </td>
                  <td className="p-[12px] text-end text-textColor/60 text-[11px]">
                    {[item.utmSource, item.utmMedium, item.utmCampaign]
                      .filter(Boolean)
                      .join(' / ') || '—'}
                  </td>
                  <td className="p-[12px] text-end">
                    <div className="flex justify-end gap-[6px]">
                      <ActionButton onClick={openReport(item)}>Report</ActionButton>
                      <ActionButton onClick={openEdit(item)}>Edit</ActionButton>
                      <ActionButton onClick={remove(item)} variant="danger">
                        Delete
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
