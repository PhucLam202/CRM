import { proxyActivities, sleep } from '@temporalio/workflow';
import { EvergreenActivity } from '@gitroom/orchestrator/activities/evergreen.activity';

const DEFAULT_SLEEP_MS = 3600000;
const MIN_SLEEP_MS = 60000;

const { processEvergreen } = proxyActivities<EvergreenActivity>({
  startToCloseTimeout: '10 minute',
  taskQueue: 'main',
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 1,
    initialInterval: '2 minutes',
  },
});

const sleepUntil = (value?: string | Date | null) => {
  if (!value) return DEFAULT_SLEEP_MS;

  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return DEFAULT_SLEEP_MS;

  return Math.max(MIN_SLEEP_MS, target - Date.now());
};

export async function evergreenWorkflow({
  id,
  immediately,
}: {
  id: string;
  immediately: boolean;
}) {
  while (true) {
    let nextSleep = DEFAULT_SLEEP_MS;
    try {
      if (immediately) {
        const result = await processEvergreen(id);
        nextSleep = sleepUntil(result?.nextRepostAt);
      }
    } catch (err) {}
    immediately = true;
    await sleep(nextSleep);
  }
}
