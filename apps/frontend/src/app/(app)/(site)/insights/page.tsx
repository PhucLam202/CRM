export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { GrowthInsightsPage } from '@gitroom/frontend/components/platform-analytics/growth-insights.page';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Insights`,
  description: 'Growth intelligence, recommendations, and reusable content templates.',
};

export default async function Index() {
  return <GrowthInsightsPage />;
}
