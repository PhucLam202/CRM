'use client';

import { FC, useState } from 'react';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { IntegrationLite } from './automation.types';
import {
  ContentAutomationList,
  EvergreenList,
} from './automation.lists';

interface AutomationsProps {
  integrations: IntegrationLite[];
}

type SubTab = 'evergreen' | 'content';

const subTabs: { value: SubTab; label: string }[] = [
  { value: 'evergreen', label: 'Evergreen' },
  { value: 'content', label: 'Content AI' },
];

export const Automations: FC<AutomationsProps> = ({ integrations }) => {
  const t = useT();
  const [active, setActive] = useState<SubTab>('evergreen');

  return (
    <div className="flex flex-col gap-[16px] w-full">
      <div className="flex flex-row p-[4px] border border-newTableBorder rounded-[8px] text-[14px] font-[500] self-start">
        {subTabs.map((tab) => (
          <div
            key={tab.value}
            onClick={() => setActive(tab.value)}
            className={clsx(
              'pt-[6px] pb-[5px] cursor-pointer min-w-[110px] px-[14px] text-center rounded-[6px]',
              active === tab.value && 'text-textItemFocused bg-boxFocused'
            )}
          >
            {t(`automation_tab_${tab.value}`, tab.label)}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor pr-[4px]">
        {active === 'evergreen' && <EvergreenList integrations={integrations} />}
        {active === 'content' && (
          <ContentAutomationList integrations={integrations} />
        )}
      </div>
    </div>
  );
};
