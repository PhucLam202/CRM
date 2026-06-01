import { Injectable } from '@nestjs/common';
import {
  ContentPatternInsight,
  GrowthContentTemplate,
} from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';

interface TemplateBuildOptions {
  templateCount?: number;
  templateTypes?: string[];
}

@Injectable()
export class ContentTemplateBuilderService {
  build(patterns: ContentPatternInsight[], options: TemplateBuildOptions = {}): GrowthContentTemplate[] {
    const templates = patterns.flatMap((pattern) => this.templatesForPattern(pattern));

    if (templates.length >= 4) {
      return this.prepareTemplates(templates, options);
    }

    // Default to a comprehensive set of 10 highly optimized X-specific templates
    const defaultTemplates: GrowthContentTemplate[] = [
      {
        type: 'contrarian_hook',
        title: 'The Contrarian Insight Hook',
        template: 'Most people think {topic} is about {common_belief}, but the real opportunity is {insight}. Here is why it matters: {reason}.',
        placeholders: ['topic', 'common_belief', 'insight', 'reason'],
        useCase: 'Best for standing out from standard feed noise and capturing attention instantly.',
        reason: 'Contrarian hooks generate 3.4x more reply & quote clicks compared to generic updates on X.',
        source: 'approved_library',
      },
      {
        type: 'educational_breakdown',
        title: 'Step-by-Step Concept Breakdown',
        template: 'Here is a simple breakdown of {concept}:\n\n1. {step_1} - {detail_1}\n2. {step_2} - {detail_2}\n3. {step_3} - {detail_3}\n\nThe key takeaway: {takeaway}.',
        placeholders: ['concept', 'step_1', 'detail_1', 'step_2', 'detail_2', 'step_3', 'detail_3', 'takeaway'],
        useCase: 'Perfect for educational or value-add posts designed to earn bookmarks.',
        reason: 'Educational breakdown templates structure complex topics into easily saved lists.',
        source: 'approved_library',
      },
      {
        type: 'case_study',
        title: 'Engineering/Growth Case Study',
        template: 'How {project_name} achieved {remarkable_metric} by doing the exact opposite of industry standards:\n\n- The problem: {problem_context}\n- The pivot: {pivot_strategy}\n- The results: {outcomes}\n\nHere is the simple checklist to replicate this: {actionable_checklist}.',
        placeholders: ['project_name', 'remarkable_metric', 'problem_context', 'pivot_strategy', 'outcomes', 'actionable_checklist'],
        useCase: 'Ideal for authority building and proving deep technical/domain competency.',
        reason: 'X algorithm favors posts that present data-backed results and actionable steps.',
        source: 'approved_library',
      },
      {
        type: 'build_in_public',
        title: 'Build-in-Public Milestone Update',
        template: 'Milestone reached: We just hit {milestone} for {project_name}! 🎉\n\nIt took us {timeframe} to get here. Here are the 3 hard lessons we learned along the way:\n1. {lesson_1}\n2. {lesson_2}\n3. {lesson_3}\n\nWhat is your biggest blocker this week? Let\'s troubleshoot in the replies.',
        placeholders: ['milestone', 'project_name', 'timeframe', 'lesson_1', 'lesson_2', 'lesson_3'],
        useCase: 'Generates community support, updates users, and builds strong personal narrative.',
        reason: 'Build-in-Public updates create highly supportive community reply hubs.',
        source: 'approved_library',
      },
      {
        type: 'hidden_angle',
        title: 'The Hidden Angle Post',
        template: 'One thing people miss about {subject} is {hidden_angle}.\n\nWhile everyone focuses on {distraction}, the real value is accumulating in {value_driver}.\n\nWhy it matters: {reason}.',
        placeholders: ['subject', 'hidden_angle', 'distraction', 'value_driver', 'reason'],
        useCase: 'Best for showcasing expert positioning and advanced research.',
        reason: 'Differentiated insights score high on retention and shareability signals.',
        source: 'approved_library',
      },
      {
        type: 'thread_starter',
        title: 'High-Converting Thread Hook',
        template: 'I spent {time_spent} analyzing {subject}, looking through {source_data}.\n\nHere is a simple, no-fluff summary of the {takeaway_count} most important lessons you need to know to save yourself {time_saved}:',
        placeholders: ['time_spent', 'subject', 'source_data', 'takeaway_count', 'time_saved'],
        useCase: 'Launch-pad for deep-dive threads or link outlines.',
        reason: 'Thread hooks require massive credibility + high-benefit statements to earn retweets.',
        source: 'approved_library',
      },
      {
        type: 'resource_list',
        title: 'The Resource Curator List',
        template: 'Here are {count} resources that will save you {time_saved} when building {activity}:\n\n1. {tool_1} - {use_case_1}\n2. {tool_2} - {use_case_2}\n3. {tool_3} - {use_case_3}\n\nBookmark this for later reference.',
        placeholders: ['count', 'time_saved', 'activity', 'tool_1', 'use_case_1', 'tool_2', 'use_case_2', 'tool_3', 'use_case_3'],
        useCase: 'Extremely high value-to-text density designed for bookmark velocity.',
        reason: 'Curated lists see the highest bookmark-to-impression ratios on modern social feeds.',
        source: 'approved_library',
      },
      {
        type: 'myth_buster',
        title: 'Common Myth Buster',
        template: 'Myth: {common_myth}.\nReality: {surprising_reality}.\n\nHere is the raw data most people overlook: {raw_data_insight}.\n\nIf you want to avoid {negative_consequence}, make sure you {corrective_action}.',
        placeholders: ['common_myth', 'surprising_reality', 'raw_data_insight', 'negative_consequence', 'corrective_action'],
        useCase: 'Creates healthy debate and establishes deep critical-thinking positioning.',
        reason: 'Myth-busting content challenges consensus, triggering strong organic engagement.',
        source: 'approved_library',
      },
      {
        type: 'quick_checklist',
        title: 'Actionable Performance Checklist',
        template: 'The ultimate checklist for {process} in 2026:\n\n- [ ] {check_1} (reduces {waste_1})\n- [ ] {check_2} (boosts {efficiency_1})\n- [ ] {check_3} (secures {result_1})\n\nSave this checklist and try it out tomorrow morning.',
        placeholders: ['process', 'check_1', 'waste_1', 'check_2', 'efficiency_1', 'check_3', 'result_1'],
        useCase: 'Direct, bite-sized checklists that are instantly applicable.',
        reason: 'Checklists are quick to consume, leading to high reposts and shares.',
        source: 'approved_library',
      },
      {
        type: 'question_prompt',
        title: 'High-Engagement Question Prompt',
        template: 'If you are building in {narrative}, what is the single biggest blocker you are facing with {activity}?\n\nIs it:\n1. {blocker_1}\n2. {blocker_2}\n3. {blocker_3}\n\nDrop your answer below. I will breakdown solutions for the top answers.',
        placeholders: ['narrative', 'activity', 'blocker_1', 'blocker_2', 'blocker_3'],
        useCase: 'Used primarily to trigger high conversation rates and algorithm reply boosts.',
        reason: 'Algorithm weights replies highly; interactive prompts trigger this directly.',
        source: 'approved_library',
      }
    ];

    if (templates.length) {
      // Merge deterministic matches with defaults to ensure we have a rich list of 10 items
      const existingTypes = new Set(templates.map(t => t.type));
      const combined = [...templates];
      for (const t of defaultTemplates) {
        if (combined.length >= 10) break;
        if (!existingTypes.has(t.type)) {
          combined.push(t);
        }
      }
      return this.prepareTemplates(combined, options);
    }

    return this.prepareTemplates(defaultTemplates, options);
  }

  private prepareTemplates(
    templates: GrowthContentTemplate[],
    options: TemplateBuildOptions
  ): GrowthContentTemplate[] {
    const count = Math.min(Math.max(options.templateCount || 10, 1), 20);
    const requestedTypes = new Set((options.templateTypes || []).filter(Boolean));
    const filtered = requestedTypes.size
      ? templates.filter((template) => requestedTypes.has(template.type))
      : templates;
    const selected = filtered.length ? filtered : templates;

    return selected.slice(0, count).map((template) => ({
        ...template,
        source: template.source || 'pattern_match',
      } satisfies GrowthContentTemplate));
  }

  private templatesForPattern(pattern: ContentPatternInsight): GrowthContentTemplate[] {
    const lower = pattern.pattern.toLowerCase();

    if (lower.includes('project')) {
      return [
        {
          type: 'project_analysis',
          title: 'Project Insight Breakdown',
          template: 'I spent some time looking into {project_name}. The most interesting part is {specific_feature}, because {reason}. Here is why it matters: {insight}.',
          placeholders: ['project_name', 'specific_feature', 'reason', 'insight'],
          useCase: 'Use for project research posts.',
          reason: pattern.evidence,
        },
        {
          type: 'hidden_angle',
          title: 'Hidden Angle Post',
          template: 'One thing people miss about {project_name} is {hidden_angle}. It matters because {reason}. If this plays out, {expected_outcome}.',
          placeholders: ['project_name', 'hidden_angle', 'reason', 'expected_outcome'],
          useCase: 'Use when sharing a differentiated view about a project.',
          reason: pattern.evidence,
        },
      ];
    }

    if (lower.includes('educational')) {
      return [
        {
          type: 'educational_breakdown',
          title: 'Step-by-Step Concept Explainer',
          template: 'Here is a simple breakdown of {concept}:\n\n1. {point_1}\n2. {point_2}\n3. {point_3}\n\nMost people miss {hidden_detail}.',
          placeholders: ['concept', 'point_1', 'point_2', 'point_3', 'hidden_detail'],
          useCase: 'Use for educational posts designed to earn bookmarks.',
          reason: pattern.evidence,
        },
      ];
    }

    if (lower.includes('question')) {
      return [
        {
          type: 'question_cta',
          title: 'Specific Reply Prompt',
          template: 'If you are following {narrative}, pay attention to {project_name} because {reason}. What is the strongest signal you are watching?',
          placeholders: ['narrative', 'project_name', 'reason'],
          useCase: 'Use when the goal is to increase replies and conversation quality.',
          reason: pattern.evidence,
        },
      ];
    }

    if (lower.includes('opinion')) {
      return [
        {
          type: 'strong_opinion_hook',
          title: 'Contrarian Hook',
          template: 'Most people think {topic} is about {common_belief}, but I think the real opportunity is {contrarian_insight}. The reason: {reason}.',
          placeholders: ['topic', 'common_belief', 'contrarian_insight', 'reason'],
          useCase: 'Use when creating a stronger first-line hook.',
          reason: pattern.evidence,
        },
      ];
    }

    return [];
  }
}
