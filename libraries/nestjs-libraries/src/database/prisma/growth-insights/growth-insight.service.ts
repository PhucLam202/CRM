import { BadRequestException, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { GrowthInsightRepository } from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insight.repository';
import { PostAnalyticsSnapshotService } from '@gitroom/nestjs-libraries/database/prisma/growth-insights/post-analytics-snapshot.service';
import { GrowthRecommendationService } from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-recommendation.service';
import { ContentTemplateBuilderService } from '@gitroom/nestjs-libraries/database/prisma/growth-insights/content-template-builder.service';
import { LlmRouterService } from '@gitroom/nestjs-libraries/llm/llm-router.service';
import {
  AnalyzedPost,
  ContentPatternInsight,
  GenerateGrowthInsightInput,
  GrowthAnalysisResult,
  GrowthPostDigestItem,
  GrowthPost,
  GrowthVoiceProfile,
  PostContentFeatures,
  PostMetricSnapshotResult,
  SaveContentTemplateInput,
  DailySuggestion,
} from '@gitroom/nestjs-libraries/database/prisma/growth-insights/growth-insights.types';

const suggestionsDictionary: Record<string, Array<{ title: string; template: string; focus: string; templateType: string; reason: string }>> = {
  ai_tech: [
    {
      title: "The AI agent opportunity",
      template: "Most people think AI agents are just about simple chatbots, but the real opportunity is autonomous multi-agent pipelines that replace entire workflows. Here is why it matters: you can automate complex research, coding, and writing for $0.05 per run instead of hiring 3 people.",
      focus: "contrarian_hook",
      templateType: "contrarian_hook",
      reason: "Contrarian AI hooks generate high replies and quote clicks compared to generic updates on X."
    },
    {
      title: "Autonomous multi-agent breakdown",
      template: "Here is a simple breakdown of autonomous multi-agent workflows:\n\n1. Orchestration Layer - routes tasks to specific AI agents.\n2. Tool Execution - agents read databases, search Google, or run code sandbox.\n3. Critic Agent - reviews the draft against instructions and corrects mistakes.\n\nThe key takeaway: structure your prompts into multi-step agent networks to see a 10x quality jump.",
      focus: "educational_breakdown",
      templateType: "educational_breakdown",
      reason: "Structured step-by-step explainer builds strong authority and encourages bookmark saves."
    },
    {
      title: "Agent case study",
      template: "How our new dev tool achieved 10,000 active developers by doing the exact opposite of industry standards:\n\n- The problem: developers hate slow, heavy IDE extensions.\n- The pivot: we built a lightweight, headless terminal CLI agent.\n- The results: 10k users in 30 days entirely through terminal terminal commands and shell integrations.\n\nHere is the simple checklist to replicate this: build open-source tools that reside directly inside current dev workflows.",
      focus: "case_study",
      templateType: "case_study",
      reason: "Real-world engineering case studies build high trust and credibility."
    },
    {
      title: "Common LLM myth buster",
      template: "Myth: You need a huge 70B+ parameter model for standard classification tasks.\nReality: Fine-tuned 8B models perform just as well at a fraction of the latency.\n\nHere is the raw data most people overlook: smaller models can be trained to specialize on specific JSON structures, yielding 99.4% accuracy at 1/10th the cost.\n\nIf you want to avoid massive API bills, make sure you optimize your inference pipelines.",
      focus: "myth_buster",
      templateType: "myth_buster",
      reason: "Myth-busting content challenges standard industry consensus, driving debate."
    },
    {
      title: "AI dev checklist",
      template: "The ultimate checklist for production-grade AI agents in 2026:\n\n- [ ] Multi-agent loops (reduces hallucination risk by 40%)\n- [ ] Local semantic cache (boosts query response speed by 90%)\n- [ ] Automated evaluations (secures consistent JSON schema compliance)\n\nSave this checklist and try it out on your next build.",
      focus: "quick_checklist",
      templateType: "quick_checklist",
      reason: "Bite-sized checklists are highly shareable and earn bookmark signals."
    },
    {
      title: "Curated AI dev stack",
      template: "Here are 3 open-source libraries that will save you 100+ hours when building AI agents:\n\n1. LangGraph - complex multi-agent state machines\n2. LlamaIndex - optimized vector retrieval and ingestion\n3. Ollama - local offline small model inference\n\nBookmark this for later reference.",
      focus: "resource_list",
      templateType: "resource_list",
      reason: "Curated listicles capture massive bookmarks and retweets from builders."
    },
    {
      title: "Interactive AI agent prompt",
      template: "If you are building in the AI agents space, what is the single biggest blocker you are facing with production deployments?\n\nIs it:\n1. Non-deterministic JSON schemas\n2. Massive token latency\n3. Infinite loop state errors\n\nDrop your answer below. I will breakdown solutions for the top answers.",
      focus: "question_prompt",
      templateType: "question_prompt",
      reason: "Interactive prompts directly trigger the X algorithm reply boost."
    }
  ],
  business_saas: [
    {
      title: "The micro-SaaS pivot",
      template: "Most people think SaaS growth is about raising venture capital and scaling sales, but the real opportunity is highly focused micro-SaaS built by solo indie hackers. Here is why it matters: a single developer can build a $10k/mo MRR tool with 95% margins without ever talking to investors.",
      focus: "contrarian_hook",
      templateType: "contrarian_hook",
      reason: "Solo-hacker contrarian posts earn high bookmark and reply rates."
    },
    {
      title: "Micro-SaaS monetization explainer",
      template: "Here is a simple breakdown of the micro-SaaS playbook:\n\n1. Pain Point Mapping - find specific tasks people are doing manually in Google Sheets.\n2. Chrome Extension wrapper - build a simple UI overlay to speed up that specific task.\n3. Usage-based pricing - charge per action instead of high monthly subscription fees.\n\nThe key takeaway: pick a small, painful niche and monetize the utility directly.",
      focus: "educational_breakdown",
      templateType: "educational_breakdown",
      reason: "Actionable micro-SaaS guides establish authority and are highly saved."
    },
    {
      title: "Indie hacking case study",
      template: "How our side project achieved $5k MRR in 14 days by doing the exact opposite of industry standards:\n\n- The problem: standard tools have bloated dashboards and slow login flows.\n- The pivot: we built a single-page tool that requires no email login to start testing.\n- The results: viral traffic from ProductHunt and HackerNews with a 23% sign-up conversion.\n\nHere is the simple checklist to replicate this: make your time-to-value under 10 seconds.",
      focus: "case_study",
      templateType: "case_study",
      reason: "Indie hack case studies drive high engagement from other founders."
    },
    {
      title: "The venture myth buster",
      template: "Myth: You need a co-founder and a massive seed round to build a scalable startup.\nReality: Modern AI-assisted tooling allows single developers to build complex systems.\n\nHere is the raw data most people overlook: 42% of startups funded in the last 2 years failed because they scaled their teams before finding product-market fit.\n\nIf you want to avoid dilution and burn rate, make sure you bootstrap to initial revenue first.",
      focus: "myth_buster",
      templateType: "myth_buster",
      reason: "Challenging funding myths resonates strongly with bootstrap founders."
    },
    {
      title: "Bootstrap checklist",
      template: "The ultimate checklist for bootstrapping a SaaS to $10k MRR in 2026:\n\n- [ ] Clear daily cold email campaigns (reduces CAC by 60%)\n- [ ] Stripe checkout templates (boosts payment completion by 25%)\n- [ ] Automated onboarding paths (secures activation rate)\n\nSave this checklist and start execution tomorrow.",
      focus: "quick_checklist",
      templateType: "quick_checklist",
      reason: "Actionable founder checklists earn high bookmark and share signals."
    },
    {
      title: "Startup growth stack",
      template: "Here are 3 tools that will save you $1000+ when launching your SaaS startup:\n\n1. Supabase - open-source database and auth infrastructure\n2. Resend - beautiful clean transactional email API\n3. LemonSqueezy - global merchant of record for SaaS tax\n\nBookmark this for later reference.",
      focus: "resource_list",
      templateType: "resource_list",
      reason: "Curated lists of resources capture massive saves and retweets."
    },
    {
      title: "Founder blocker prompt",
      template: "If you are bootstrapping a SaaS right now, what is the single biggest blocker you are facing with customer acquisition?\n\nIs it:\n1. Zero cold-outreach replies\n2. High landing page bounce rates\n3. Users churn after the trial\n\nDrop your answer below. I will breakdown solutions for the top answers.",
      focus: "question_prompt",
      templateType: "question_prompt",
      reason: "High conversation prompts earn active engagement from bootstrap founders."
    }
  ],
  crypto_finance: [
    {
      title: "The Web3 utility pivot",
      template: "Most people think Web3 is about speculative memecoins and fast trading, but the real opportunity is decentralized physical infrastructure networks (DePIN) that earn real yield. Here is why it matters: hardware networks solve real-world latency issues, creating sustainable revenue models.",
      focus: "contrarian_hook",
      templateType: "contrarian_hook",
      reason: "Differentiated tech narratives yield better discussion signals on Web3 X."
    },
    {
      title: "DePIN yield model breakdown",
      template: "Here is a simple breakdown of the DePIN economic playbook:\n\n1. Hardware Node Setup - deploy small physical devices (storage/computing/Wi-Fi).\n2. Token Emission Incentives - nodes earn protocol tokens for uploading proof-of-work.\n3. Corporate Demand Buyback - companies pay in cash to rent resources, creating buy pressure.\n\nThe key takeaway: follow protocol yield backed by real corporate hardware rental demand.",
      focus: "educational_breakdown",
      templateType: "educational_breakdown",
      reason: "Step-by-step yield economics are highly bookmarked by research accounts."
    },
    {
      title: "Web3 protocol analysis",
      template: "How this new storage protocol achieved $4M in ARR by doing the exact opposite of industry standards:\n\n- The problem: standard clouds have centralized storage single-points-of-failure.\n- The pivot: we incentivized local household hard drives globally.\n- The results: 100x cheaper storage cost compared to Amazon S3 with 99.999% uptime.\n\nHere is the simple checklist to replicate this: incentivize unused global physical capacity.",
      focus: "case_study",
      templateType: "case_study",
      reason: "Web3 tokenomics and analysis posts generate high bookmark and reply rates."
    },
    {
      title: "The crypto meme myth buster",
      template: "Myth: You need millions of dollars in VC backing to launch a decentralized protocol.\nReality: Bootstrap communities launched via fair emissions have much higher retention.\n\nHere is the raw data most people overlook: 88% of high-VC funded tokens dropped 90% in price after launch because of continuous token unlocks dumping on retail.\n\nIf you want to protect your portfolio, pay attention to protocols with low FDV and high circulating float.",
      focus: "myth_buster",
      templateType: "myth_buster",
      reason: "VC vs Retail myths spark organic discussion and high quote rate."
    },
    {
      title: "Web3 safety checklist",
      template: "The ultimate checklist for smart contract safety and portfolio security in 2026:\n\n- [ ] Clean multisig wallets (reduces exploit risk by 80%)\n- [ ] Revoke unused contract approvals (boosts asset safety by 95%)\n- [ ] Local node verification (secures RPC connection)\n\nSave this checklist and verify your wallets tonight.",
      focus: "quick_checklist",
      templateType: "quick_checklist",
      reason: "Safety checklists are highly shared and bookmarked in Web3."
    },
    {
      title: "Web3 research tools",
      template: "Here are 3 research platforms that will save you 50+ hours when analyzing crypto protocols:\n\n1. DefiLlama - comprehensive multi-chain TVL and volume analytics\n2. Dune Analytics - custom SQL-based on-chain dashboard metrics\n3. TokenTerminal - financial statements (P/E ratios) for protocol earnings\n\nBookmark this for later reference.",
      focus: "resource_list",
      templateType: "resource_list",
      reason: "Curated research directories gain immense bookmark counts from active researchers."
    },
    {
      title: "Web3 narrative blocker",
      template: "If you are following decentralized infrastructure narratives, what is the single biggest blocker stopping mass household adoption?\n\nIs it:\n1. Complex crypto wallet setups\n2. High initial node hardware costs\n3. Unstable regulatory conditions\n\nDrop your answer below. I will breakdown solutions for the top answers.",
      focus: "question_prompt",
      templateType: "question_prompt",
      reason: "Prompts regarding narrative blockers trigger high organic discussion."
    }
  ],
  marketing_copy: [
    {
      title: "Audience building opportunity",
      template: "Most people think marketing is about high budget ad campaigns and clever branding, but the real opportunity is personal brand storytelling built entirely around raw micro-lessons. Here is why it matters: personal content gets 10x higher click-through-rates because humans buy from other humans.",
      focus: "contrarian_hook",
      templateType: "contrarian_hook",
      reason: "Contrarian positioning in marketing generates high conversation volume."
    },
    {
      title: "Audience playbook explainer",
      template: "Here is a simple breakdown of the audience building flywheel:\n\n1. Micro-lessons - share daily mistakes and small solutions in clear 2-minute posts.\n2. Curated Resource Hubs - group those solutions into high-converting PDF/Notion guides.\n3. Zero-dollar launch - give the resource for free in exchange for email newsletter signups.\n\nThe key takeaway: focus on utility curation rather than generic self-promotion.",
      focus: "educational_breakdown",
      templateType: "educational_breakdown",
      reason: "Clear growth/marketing playbooks score high on save and bookmark signals."
    },
    {
      title: "Viral marketing case study",
      template: "How our landing page achieved a 58% email conversion rate by doing the exact opposite of industry standards:\n\n- The problem: standard SaaS landing pages have long feature lists and pricing grids.\n- The pivot: we stripped the page to a single input field promising a 1-click audit.\n- The results: 50,000 email signups in 30 days entirely through organic X shares.\n\nHere is the simple checklist to replicate this: make your sign-up form offer an immediate custom reward.",
      focus: "case_study",
      templateType: "case_study",
      reason: "Landing page conversion case studies attract massive views from creators."
    },
    {
      title: "The SEO myth buster",
      template: "Myth: You need to publish 50 keywords/articles a month to build Google search authority.\nReality: 3 high-intent, hyper-specific guides will drive 90% of SaaS conversions.\n\nHere is the raw data most people overlook: 91% of search pages get zero traffic because they target generic keywords instead of answering exact search queries.\n\nIf you want to scale organic signups, focus on high-intent search loops.",
      focus: "myth_buster",
      templateType: "myth_buster",
      reason: "Debunking SEO/content myths triggers high comment shares from marketers."
    },
    {
      title: "Content marketing checklist",
      template: "The ultimate checklist for high-converting social copywriting in 2026:\n\n- [ ] Strong contrarian opening hooks (reduces scroll-past rate by 50%)\n- [ ] Clean bullet-point lists (boosts dwell time by 75%)\n- [ ] Exact, value-first CTA links (secures referral rate)\n\nSave this checklist and try it on your next post.",
      focus: "quick_checklist",
      templateType: "quick_checklist",
      reason: "Practical writing checklists earn strong bookmark and retweet metrics."
    },
    {
      title: "Copywriting tool suite",
      template: "Here are 3 free copywriting tools that will save you 10+ hours when drafting content:\n\n1. Hemingway App - helps you strip passive voice and make sentences punchy\n2. Headline Studio - scores first-line hooks for high click-through rates\n3. Notion Templates - catalog and repurpose your high-performing drafts\n\nBookmark this for later reference.",
      focus: "resource_list",
      templateType: "resource_list",
      reason: "Lists of utility tools drive immense organic share and save rates."
    },
    {
      title: "Marketing acquisition prompt",
      template: "If you are launching a product right now, what is the single biggest challenge you are facing with content distribution?\n\nIs it:\n1. Writing high-hook opening lines\n2. Converting page views into signups\n3. Retaining email newsletter subscribers\n\nDrop your answer below. I will breakdown solutions for the top answers.",
      focus: "question_prompt",
      templateType: "question_prompt",
      reason: "Growth-focused prompts get massive replies from marketers and creators."
    }
  ],
  productivity_growth: [
    {
      title: "Deep work opportunity",
      template: "Most people think productivity is about planning 12-hour workdays and multi-tasking, but the real opportunity is 4 hours of strict deep work free from all digital distractions. Here is why it matters: deep focus yields 5x higher output quality because your brain avoids task-switching lag.",
      focus: "contrarian_hook",
      templateType: "contrarian_hook",
      reason: "Productivity contrarian posts resonate widely across all builder profiles."
    },
    {
      title: "Time-blocking blueprint",
      template: "Here is a simple breakdown of the time-blocking playbook:\n\n1. Deep Focus Block - spend the first 3 hours of the day on single high-impact tasks.\n2. Leverage Buffer - group calendar meetings and email replies into a single afternoon block.\n3. Complete Shutdown - disconnect fully after 6 PM to let your mind recharge.\n\nThe key takeaway: block energy intervals, not calendar time slots.",
      focus: "educational_breakdown",
      templateType: "educational_breakdown",
      reason: "Practical career/focus blueprints score massive bookmark actions."
    },
    {
      title: "Energy focus case study",
      template: "How our founder achieved 2x higher engineering output while working only 4 days a week:\n\n- The problem: constantly interrupted by Slack notifications and ad-hoc syncs.\n- The pivot: we moved all team communication to asynchronous daily updates.\n- The results: shipping speed doubled while engineering stress levels plummeted.\n- Here is the checklist to replicate this: make your primary calendar block focus on deep asynchronous execution.",
      focus: "case_study",
      templateType: "case_study",
      reason: "Energy focus and asynchronous culture cases get massive shares."
    },
    {
      title: "The busywork myth buster",
      template: "Myth: Replying to emails and Slack messages immediately makes you a productive team member.\nReality: Constant instant availability fragments your attention, preventing deep thinking.\n\nHere is the raw data most people overlook: it takes an average of 23 minutes to refocus on a complex task after a single minor notification interruption.\n\nIf you want to scale your technical leverage, turn off instant notifications.",
      focus: "myth_buster",
      templateType: "myth_buster",
      reason: "Time/focus myths drive high organic quote and share rate."
    },
    {
      title: "Daily deep work checklist",
      template: "The ultimate checklist for maintaining daily high-focus energy in 2026:\n\n- [ ] Clean digital workspace layouts (reduces cognitive clutter by 45%)\n- [ ] Strictly scheduled email checks (boosts flow state by 80%)\n- [ ] 20-minute physical walk intervals (secures baseline focus)\n\nSave this checklist and try it out tomorrow morning.",
      focus: "quick_checklist",
      templateType: "quick_checklist",
      reason: "Daily habit checklist cards earn extremely high bookmark scores."
    },
    {
      title: "Focus environment apps",
      template: "Here are 3 productivity apps that will save you 10+ hours a week of distracted browsing:\n\n1. Cold Turkey - block specific website domains during focus hours\n2. Obsidian - local offline markdown notes designed for second-brain indexing\n3. Alfred/Raycast - highly fast keyboard launcher to bypass UI mouse navigation\n\nBookmark this for later reference.",
      focus: "resource_list",
      templateType: "resource_list",
      reason: "Focus-tool lists yield amazing saves and retweets from builders."
    },
    {
      title: "Energy drain prompt",
      template: "If you are executing deep work campaigns, what is the single biggest energy drain you struggle with during the day?\n\nIs it:\n1. Ad-hoc calendar meeting requests\n2. Constant Slack/Discord chat checks\n3. Mid-afternoon focus fatigue\n\nDrop your answer below. I will breakdown solutions for the top answers.",
      focus: "question_prompt",
      templateType: "question_prompt",
      reason: "Energy drain prompts get large reply counts from builders."
    }
  ]
};

@Injectable()
export class GrowthInsightService {
  constructor(
    private _integrationService: IntegrationService,
    private _repository: GrowthInsightRepository,
    private _snapshotService: PostAnalyticsSnapshotService,
    private _recommendations: GrowthRecommendationService,
    private _templateBuilder: ContentTemplateBuilderService,
    private _llmRouter: LlmRouterService
  ) {}

  async generate(organizationId: string, integrationId: string, input: GenerateGrowthInsightInput) {
    const period = this.parsePeriod(input);
    const niche = input.niche || 'ai_tech';
    const growthGoal = input.growthGoal || '5_days';
    const language = input.language || 'en';
    const templateCount = Math.min(Math.max(input.templateCount || 10, 1), 20);
    const templateTypes = Array.isArray(input.templateTypes) ? input.templateTypes : [];

    const integration = await this._integrationService.getIntegrationById(
      organizationId,
      integrationId
    );

    if (!integration || integration.type !== 'social') {
      throw new BadRequestException('Integration not found');
    }

    if (integration.providerIdentifier !== 'x') {
      throw new BadRequestException('Growth Intelligence currently supports X provider first');
    }

    const posts = (await this._repository.getPublishedPostsByIntegration(
      organizationId,
      integrationId,
      period.from,
      period.to
    )) as GrowthPost[];

    if (!posts.length) {
      throw new BadRequestException('No published posts found in this period');
    }

    const snapshotResult = await this._snapshotService.ensureSnapshots({
      organizationId,
      integrationId,
      provider: integration.providerIdentifier,
      posts,
      periodDays: period.days,
      forceRefresh: input.forceRefresh,
    });

    const deterministic = this.analyze({
      posts: snapshotResult.results,
      periodDays: period.days,
      metricsFetched: snapshotResult.metricsFetched,
      snapshotsUsed: snapshotResult.snapshotsUsed,
      templateCount,
      templateTypes,
      language,
      niche,
      growthGoal,
    });

    // Populate deterministic parameters & suggested daily posts first
    deterministic.niche = niche;
    deterministic.growthGoal = growthGoal;
    deterministic.language = language;
    deterministic.dailySuggestions = this.generateDeterministicSuggestions(niche, growthGoal, language);

    deterministic.sourceStats = {
      ...(deterministic.sourceStats || {}),
      niche,
      growthGoal,
      language,
      templateCount,
      templateTypes,
    };

    // AI is used as a final refinement layer and can produce ready-to-use daily posts.
    const refined = await this.refineWithAi(deterministic, niche, growthGoal, language);

    // Save niche, growthGoal, and dailySuggestions dynamically inside the sourceStats JSON to prevent unnecessary DB schema migrations
    refined.sourceStats = {
      ...(refined.sourceStats || {}),
      niche: refined.niche || niche,
      growthGoal: refined.growthGoal || growthGoal,
      language: refined.language || language,
      templateCount,
      templateTypes,
      ai: refined.ai || {
        used: false,
        fallback: true,
        reason: 'not_available',
      },
      dailySuggestions: refined.dailySuggestions || deterministic.dailySuggestions,
    };

    const saved = await this._repository.createInsight({
      organizationId,
      integrationId,
      provider: integration.providerIdentifier,
      periodFrom: period.from,
      periodTo: period.to,
      periodDays: period.days,
      result: refined,
    });

    return this.toResponse(saved, integration);
  }

  async latest(organizationId: string, integrationId: string) {
    const integration = await this._integrationService.getIntegrationById(
      organizationId,
      integrationId
    );
    const insight = await this._repository.getLatestInsight(organizationId, integrationId);

    return insight && integration ? this.toResponse(insight, integration) : null;
  }

  async history(organizationId: string, integrationId: string, limit = 10) {
    const integration = await this._integrationService.getIntegrationById(
      organizationId,
      integrationId
    );
    const insights = await this._repository.getInsightHistory(
      organizationId,
      integrationId,
      Math.min(Math.max(limit, 1), 50)
    );

    return integration ? insights.map((insight) => this.toResponse(insight, integration)) : [];
  }

  async getById(organizationId: string, integrationId: string, insightId: string) {
    const integration = await this._integrationService.getIntegrationById(
      organizationId,
      integrationId
    );
    const insight = await this._repository.getInsightById(
      organizationId,
      integrationId,
      insightId
    );

    return insight && integration ? this.toResponse(insight, integration) : null;
  }

  async saveTemplate(
    organizationId: string,
    integrationId: string,
    input: SaveContentTemplateInput
  ) {
    const integration = await this._integrationService.getIntegrationById(
      organizationId,
      integrationId
    );

    if (!integration) {
      throw new BadRequestException('Integration not found');
    }

    if (!input.type || !input.title || !input.template || !input.placeholders?.length) {
      throw new BadRequestException('Invalid template');
    }

    return this._repository.saveTemplatePreset(
      organizationId,
      integrationId,
      integration.providerIdentifier,
      input
    );
  }

  private parsePeriod(input: GenerateGrowthInsightInput) {
    const from = dayjs(input.from).startOf('day');
    const to = dayjs(input.to).endOf('day');

    if (!from.isValid() || !to.isValid() || from.isAfter(to)) {
      throw new BadRequestException('Invalid date range');
    }

    const days = to.diff(from, 'day') + 1;
    if (days > 90) {
      throw new BadRequestException('Growth Intelligence supports up to 90 days per analysis');
    }

    return {
      from: from.toDate(),
      to: to.toDate(),
      days,
    };
  }

  private analyze(params: {
    posts: PostMetricSnapshotResult[];
    periodDays: number;
    metricsFetched: number;
    snapshotsUsed: number;
    templateCount?: number;
    templateTypes?: string[];
    language?: string;
    niche?: string;
    growthGoal?: string;
  }): GrowthAnalysisResult {
    const analyzedPosts = params.posts.map((item) => this.analyzePost(item));
    const totalImpressions = this.sum(analyzedPosts.map((post) => post.normalized.impressions));
    const totalEngagements = this.sum(analyzedPosts.map((post) => post.normalized.engagements));
    const engagementRate = totalImpressions > 0 ? totalEngagements / totalImpressions : 0;
    const postingDays = new Set(
      analyzedPosts.map((post) => dayjs(post.post.publishDate).format('YYYY-MM-DD'))
    ).size;
    const consistencyScore = Math.round((postingDays / Math.min(params.periodDays, analyzedPosts.length || 1)) * 100);
    const patterns = this.detectPatterns(analyzedPosts);
    const postsPerDay = analyzedPosts.length / params.periodDays;
    const recommendations = this._recommendations.build({
      posts: analyzedPosts,
      patterns,
      postsPerDay,
      engagementRate,
      consistencyScore,
      niche: params.niche,
      growthGoal: params.growthGoal,
      templateTypes: params.templateTypes,
    });
    const templates = this._templateBuilder.build(patterns, {
      templateCount: params.templateCount,
      templateTypes: params.templateTypes,
    });
    const averageImpressions = totalImpressions / analyzedPosts.length;

    return {
      accountSummary: `In this period, the account published ${analyzedPosts.length} posts and generated ${totalImpressions.toLocaleString()} impressions. The strongest detected pattern was ${patterns[0]?.pattern.toLowerCase() || 'not clear yet'}.`,
      diagnosis: {
        postingVolume: postsPerDay >= 1 ? 'good' : postsPerDay >= 0.5 ? 'medium' : 'needs_improvement',
        reachQuality: averageImpressions >= 1000 ? 'good' : averageImpressions >= 250 ? 'medium' : 'needs_improvement',
        engagementQuality: engagementRate >= 0.03 ? 'good' : engagementRate >= 0.01 ? 'medium' : 'needs_improvement',
        consistency: consistencyScore >= 80 ? 'good' : consistencyScore >= 50 ? 'medium' : 'needs_improvement',
      },
      contentPatterns: patterns,
      recommendations,
      templates,
      scoreBreakdown: {
        overall: Math.round((Math.min(100, averageImpressions / 10) + Math.min(100, engagementRate * 2500) + consistencyScore) / 3),
        postingVolume: Math.round(Math.min(100, postsPerDay * 100)),
        reachQuality: Math.round(Math.min(100, averageImpressions / 10)),
        engagementQuality: Math.round(Math.min(100, engagementRate * 2500)),
        consistency: consistencyScore,
        totalImpressions,
        totalEngagements,
        engagementRate: Number((engagementRate * 100).toFixed(2)),
      },
      sourceStats: {
        postsAnalyzed: analyzedPosts.length,
        snapshotsUsed: params.snapshotsUsed,
        metricsFetched: params.metricsFetched,
        fromDatabase: params.snapshotsUsed > 0,
        periodDays: params.periodDays,
      },
      postDigest: this.buildPostDigest(analyzedPosts),
      voiceProfile: this.buildVoiceProfile(analyzedPosts),
    };
  }

  private analyzePost(item: PostMetricSnapshotResult): AnalyzedPost {
    const features = this.extractFeatures(item.post.content);
    const patterns = [
      ...(features.isProjectAnalysis ? ['project_analysis'] : []),
      ...(features.isEducational ? ['educational_breakdown'] : []),
      ...(features.isOpinionated ? ['opinion_hook'] : []),
      ...(features.hasQuestion ? ['question_cta'] : []),
      ...(features.isGenericUpdate ? ['generic_update'] : []),
    ];
    const score =
      Math.min(50, item.normalized.impressions / 100) +
      Math.min(30, item.normalized.engagementRate * 1000) +
      Math.min(20, (item.normalized.replyRate + item.normalized.bookmarkRate) * 1000);

    return { ...item, features, patterns, score: Math.round(score) };
  }

  private extractFeatures(content: string): PostContentFeatures {
    const lower = content.toLowerCase();
    const firstLine = content.split('\n')[0] || content;

    return {
      contentLength: content.length,
      hasQuestion: content.includes('?'),
      hasCTA: /\b(reply|comment|share|follow|what do you think|thoughts)\b/i.test(content),
      hasNumberedList: /(^|\n)\s*\d+[.)]/.test(content),
      hasThreadSignal: /\b(thread|breakdown|here is|let's unpack)\b/i.test(content),
      hasStrongOpening: firstLine.length <= 140 && /\b(most people|one thing|why|how|if you|i think|the real)\b/i.test(firstLine),
      isEducational: /\b(how|why|breakdown|simple|guide|learn|explained|here is)\b/i.test(lower),
      isProjectAnalysis: /\b(project|protocol|token|feature|roadmap|ecosystem|looking into|interesting part)\b/i.test(lower),
      isOpinionated: /\b(i think|most people|underrated|overrated|miss|real opportunity|hot take)\b/i.test(lower),
      isGenericUpdate: content.length < 120 && !content.includes('?') && !/\b(because|why|how|insight|reason)\b/i.test(lower),
    };
  }

  private detectPatterns(posts: AnalyzedPost[]): ContentPatternInsight[] {
    const candidates = [
      { key: 'project_analysis', label: 'Project-specific analysis posts performed best.' },
      { key: 'educational_breakdown', label: 'Educational breakdown posts performed best.' },
      { key: 'opinion_hook', label: 'Opinion-led hooks performed best.' },
      { key: 'question_cta', label: 'Question-driven posts created stronger conversation signals.' },
    ];
    const baseline = this.average(posts.map((post) => post.score));

    const scoredPatterns = candidates
      .map((candidate) => {
        const matching = posts.filter((post) => post.patterns.includes(candidate.key));
        const averageScore = this.average(matching.map((post) => post.score));
        return {
          matchingCount: matching.length,
          pattern: candidate.label,
          evidence: `${matching.length} posts matched this pattern and scored ${Math.round(averageScore)} on average versus ${Math.round(baseline)} overall.`,
          impact: 'Use this pattern to improve the odds of higher reach and stronger engagement quality.',
          strength: matching.length ? averageScore - baseline : 0,
        };
      })
      .sort((left, right) => right.strength - left.strength);
    const winningPatterns = scoredPatterns
      .filter((pattern) => pattern.strength > 0)
      .sort((left, right) => right.strength - left.strength)
      .slice(0, 4);

    const fallbackPatterns = scoredPatterns
      .filter((pattern) => pattern.matchingCount > 0)
      .sort((left, right) => right.matchingCount - left.matchingCount || right.strength - left.strength)
      .slice(0, 4);

    return (winningPatterns.length ? winningPatterns : fallbackPatterns).map(({ matchingCount, ...pattern }) => pattern);
  }

  private buildPostDigest(posts: AnalyzedPost[]): GrowthPostDigestItem[] {
    const latestPosts = [...posts]
      .sort((left, right) => dayjs(right.post.publishDate).valueOf() - dayjs(left.post.publishDate).valueOf())
      .slice(0, 10);
    const topPosts = [...posts].sort((left, right) => right.score - left.score).slice(0, 10);
    const lowPosts = [...posts].sort((left, right) => left.score - right.score).slice(0, 5);
    const uniquePosts = new Map<string, AnalyzedPost>();

    [...topPosts, ...latestPosts, ...lowPosts].forEach((post) => {
      uniquePosts.set(post.post.id, post);
    });

    return [...uniquePosts.values()].slice(0, 25).map((post) => ({
      id: post.post.id,
      content: post.post.content.slice(0, 1200),
      publishDate: dayjs(post.post.publishDate).toISOString(),
      score: post.score,
      patterns: post.patterns,
      features: post.features,
      metrics: post.normalized,
    }));
  }

  private buildVoiceProfile(posts: AnalyzedPost[]): GrowthVoiceProfile {
    const contents = posts.map((post) => post.post.content).filter(Boolean);
    const averageLength = Math.round(this.average(contents.map((content) => content.length)));
    const firstLines = contents
      .map((content) => content.split('\n')[0]?.trim())
      .filter((line): line is string => !!line)
      .slice(0, 8);
    const hasLists = posts.filter((post) => post.features.hasNumberedList).length >= Math.max(2, posts.length * 0.25);
    const hasQuestions = posts.filter((post) => post.features.hasQuestion).length >= Math.max(2, posts.length * 0.25);
    const hasThreadSignals = posts.filter((post) => post.features.hasThreadSignal).length >= Math.max(2, posts.length * 0.2);
    const toneSignals = [
      posts.some((post) => post.features.isOpinionated) ? 'opinionated' : '',
      posts.some((post) => post.features.isEducational) ? 'educational' : '',
      posts.some((post) => post.features.isProjectAnalysis) ? 'project-specific' : '',
      posts.some((post) => post.features.isGenericUpdate) ? 'concise updates' : '',
    ].filter(Boolean);

    return {
      averageLength,
      commonOpenings: firstLines,
      formattingStyle: hasLists ? 'structured lists / numbered breakdowns' : 'short paragraph posts',
      ctaStyle: hasQuestions ? 'question-led CTA' : 'soft or minimal CTA',
      toneSignals,
    };
  }

  private async refineWithAi(result: GrowthAnalysisResult, niche?: string, growthGoal?: string, language?: string): Promise<GrowthAnalysisResult> {
    try {
      return await this._llmRouter.refineGrowthInsight({
        result,
        niche,
        growthGoal,
        language,
        postDigest: result.postDigest,
        voiceProfile: result.voiceProfile,
      });
    } catch (err) {
      return result;
    }
  }

  private toResponse(insight: any, integration: any) {
    return {
      id: insight.id,
      period: {
        from: insight.periodFrom,
        to: insight.periodTo,
        days: insight.periodDays,
      },
      account: {
        integrationId: integration.id,
        provider: integration.providerIdentifier,
        name: integration.name,
      },
      sourceStats: insight.sourceStats,
      summary: insight.accountSummary,
      diagnosis: insight.diagnosis,
      contentPatterns: insight.contentPatterns,
      recommendations: insight.recommendations,
      templates: insight.templates,
      scoreBreakdown: insight.scoreBreakdown,
      createdAt: insight.createdAt,

      // Serialize as top-level fields for API response clarity
      niche: insight.sourceStats?.niche || 'ai_tech',
      growthGoal: insight.sourceStats?.growthGoal || '5_days',
      language: insight.sourceStats?.language || 'en',
      dailySuggestions: insight.sourceStats?.dailySuggestions || [],
    };
  }

  private generateDeterministicSuggestions(niche: string, goal: string, language: string): DailySuggestion[] {
    const pool = suggestionsDictionary[niche] || suggestionsDictionary.ai_tech;
    const daysCount = goal === '7_days' || goal === 'next_week' ? 7 : 5;

    const suggestions: DailySuggestion[] = [];
    for (let i = 0; i < daysCount; i++) {
      const item = pool[i % pool.length];
      const scheduledDate = dayjs().add(i + 1, 'day');
      const formattedDate = scheduledDate.format('YYYY-MM-DD');
      const scheduledAt = scheduledDate.hour(10).minute(0).second(0).millisecond(0).toISOString();

      // Basic Vietnamese localization for the base deterministic suggestions
      let title = item.title;
      let reason = item.reason;
      let template = item.template;

      if (language === 'vi') {
        title = this.translateSuggestionTitleToVietnamese(title);
        if (title === item.title) {
          title = `Gợi ý bài đăng - ${item.title}`;
        }
        reason = 'Phân tích gợi ý chiến thuật bài đăng X hàng ngày.';
        template = this.translateSuggestionContentToVietnamese(item.templateType);
      }

      suggestions.push({
        dayNumber: i + 1,
        date: formattedDate,
        title,
        suggestedContent: template,
        focus: item.focus,
        scheduledTime: '10:00 AM',
        scheduledAt,
        templateType: item.templateType,
        reason,
      });
    }

    return suggestions;
  }

  private translateSuggestionTitleToVietnamese(title: string): string {
    const map: Record<string, string> = {
      'Deep work opportunity': 'Gợi ý bài đăng - Cơ hội deep work',
      'Time-blocking blueprint': 'Gợi ý bài đăng - Lộ trình time-blocking',
      'Energy focus case study': 'Gợi ý bài đăng - Nghiên cứu điển hình về tập trung năng lượng',
      'The busywork myth buster': 'Gợi ý bài đăng - Phá vỡ hiểu lầm về công việc vụn vặt',
      'Daily deep work checklist': 'Gợi ý bài đăng - Checklist deep work hằng ngày',
      'Focus environment apps': 'Gợi ý bài đăng - Ứng dụng hỗ trợ tập trung',
      'Energy drain prompt': 'Gợi ý bài đăng - Câu hỏi về điểm rò rỉ năng lượng',
    };

    return map[title] || title;
  }

  private translateSuggestionContentToVietnamese(templateType: string): string {
    const map: Record<string, string> = {
      contrarian_hook:
        'Phần lớn mọi người nghĩ {topic} là về {common_belief}, nhưng cơ hội thật sự là {insight}. Đây là lý do nó quan trọng: {reason}.',
      educational_breakdown:
        'Đây là phân tích đơn giản về {concept}:\n\n1. {step_1} - {detail_1}\n2. {step_2} - {detail_2}\n3. {step_3} - {detail_3}\n\nKết luận chính: {takeaway}.',
      case_study:
        'Cách {project_name} đạt được {remarkable_metric} bằng cách đi ngược lại tiêu chuẩn phổ biến:\n\n- Vấn đề: {problem_context}\n- Cách chuyển hướng: {pivot_strategy}\n- Kết quả: {outcomes}\n\nDanh sách kiểm tra để lặp lại: {actionable_checklist}.',
      myth_buster:
        'Hiểu lầm: {common_myth}.\nSự thật: {surprising_reality}.\n\nDữ liệu thô nhiều người bỏ qua là: {raw_data_insight}.\n\nNếu bạn muốn tránh {negative_consequence}, hãy chắc chắn rằng bạn {corrective_action}.',
      quick_checklist:
        'Danh sách kiểm tra tối ưu cho {process} trong năm 2026:\n\n- [ ] {check_1} (giảm {waste_1})\n- [ ] {check_2} (tăng {efficiency_1})\n- [ ] {check_3} (đảm bảo {result_1})\n\nHãy lưu lại và thử vào sáng mai.',
      resource_list:
        'Đây là {count} tài nguyên sẽ giúp bạn tiết kiệm {time_saved} khi xây dựng {activity}:\n\n1. {tool_1} - {use_case_1}\n2. {tool_2} - {use_case_2}\n3. {tool_3} - {use_case_3}\n\nHãy lưu lại để dùng sau.',
      question_prompt:
        'Nếu bạn đang thực hiện các chiến dịch deep work, trở ngại lớn nhất bạn đang gặp trong ngày là gì?\n\nCó phải là:\n1. Các yêu cầu họp đột xuất từ lịch\n2. Liên tục kiểm tra Slack/Discord\n3. Mệt mỏi tập trung vào buổi chiều\n\nHãy trả lời bên dưới. Tôi sẽ phân tích cách xử lý cho các câu trả lời nổi bật nhất.',
    };

    return map[templateType] || templateType;
  }

  private sum(values: number[]) {
    return values.reduce((total, value) => total + value, 0);
  }

  private average(values: number[]) {
    if (!values.length) {
      return 0;
    }

    return this.sum(values) / values.length;
  }
}
