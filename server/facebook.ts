const GRAPH_API_VERSION = "v24.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || "";

interface GraphApiParams {
  [key: string]: string | number | boolean | undefined;
}

async function graphApiFetch<T = any>(
  endpoint: string,
  params: GraphApiParams = {},
  method: "GET" | "POST" = "GET"
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${endpoint}`);
  const allParams = { ...params, access_token: ACCESS_TOKEN };

  if (method === "GET") {
    for (const [k, v] of Object.entries(allParams)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : {},
    body: method === "POST" ? JSON.stringify(allParams) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { error: { message: text } }; }
    const errMsg = parsed?.error?.message || text;
    const errCode = parsed?.error?.code || response.status;
    throw new FacebookApiError(errMsg, errCode, response.status);
  }

  return response.json() as Promise<T>;
}

export class FacebookApiError extends Error {
  code: number;
  httpStatus: number;
  constructor(message: string, code: number, httpStatus: number) {
    super(message);
    this.name = "FacebookApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

async function paginatedFetch<T = any>(
  endpoint: string,
  params: GraphApiParams = {},
  maxPages = 10
): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = null;
  let page = 0;

  const firstResponse = await graphApiFetch<{ data: T[]; paging?: { next?: string } }>(endpoint, params);
  results.push(...firstResponse.data);
  url = firstResponse.paging?.next || null;
  page++;

  while (url && page < maxPages) {
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text();
      throw new FacebookApiError(`Pagination error: ${text}`, resp.status, resp.status);
    }
    const json = await resp.json();
    results.push(...(json.data || []));
    url = json.paging?.next || null;
    page++;
  }

  return results;
}

export interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  business_name?: string;
}

export async function listAdAccounts(): Promise<AdAccount[]> {
  const accounts = await paginatedFetch<AdAccount>("/me/adaccounts", {
    fields: "id,name,account_id,account_status,currency,timezone_name,business_name",
    limit: 100,
  });
  return accounts.filter(a => a.account_status === 1);
}

type ActionArray = Array<{ action_type: string; value: string }>;
type VideoActionArray = Array<{ action_type: string; value: string }>;

export interface InsightRow {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend: string;
  impressions: string;
  reach?: string;
  clicks: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  frequency?: string;
  actions?: ActionArray;
  cost_per_action_type?: ActionArray;
  outbound_clicks?: ActionArray;
  cost_per_outbound_click?: ActionArray;
  outbound_clicks_ctr?: ActionArray;
  video_thru_play_actions?: VideoActionArray;
  cost_per_thru_play?: VideoActionArray;
  video_play_actions?: VideoActionArray;
  video_avg_time_watched_actions?: VideoActionArray;
  video_p25_watched_actions?: VideoActionArray;
  video_p50_watched_actions?: VideoActionArray;
  video_p75_watched_actions?: VideoActionArray;
  video_p95_watched_actions?: VideoActionArray;
  video_p100_watched_actions?: VideoActionArray;
  video_continuous_2_sec_watched_actions?: VideoActionArray;
  video_30_sec_watched_actions?: VideoActionArray;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  created_time?: string;
  updated_time?: string;
  date_start: string;
  date_stop: string;
}

export interface NormalizedInsight {
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency: number;
  leads: number;
  costPerLead: number;
  purchases: number;
  costPerPurchase: number;
  linkClicks: number;
  results: number;
  resultRate: number;
  costPerResult: number;
  outboundClicks: number;
  costPerOutboundClick: number;
  outboundCtr: number;
  thruPlays: number;
  costPerThruPlay: number;
  videoPlays: number;
  videoAvgPlayTime: number;
  videoP25: number;
  videoP50: number;
  videoP75: number;
  videoP95: number;
  videoP100: number;
  video2SecPlays: number;
  costPer2SecPlay: number;
  video3SecPlays: number;
  costPer3SecPlay: number;
  video3SecRate: number;
  searches: number;
  costPerCall: number;
  callRate: number;
  contacts: number;
  costPerContact: number;
  contactRate: number;
  landingPageConversionRate: number;
  costPer1000Reached: number;
  qualityRanking: string;
  engagementRateRanking: string;
  conversionRateRanking: string;
  dateStart: string;
  dateStop: string;
  rawActions?: ActionArray;
  rawCostPerAction?: ActionArray;
}

function getActionValue(arr: ActionArray | undefined, type: string): number {
  if (!arr) return 0;
  const found = arr.find(a => a.action_type === type);
  return found ? parseFloat(found.value) || 0 : 0;
}

function getVideoActionValue(arr: VideoActionArray | undefined): number {
  if (!arr || arr.length === 0) return 0;
  return parseFloat(arr[0]?.value || "0") || 0;
}

function normalizeInsight(row: InsightRow, includeRaw = false): NormalizedInsight {
  const actions = row.actions || [];
  const costPerAction = row.cost_per_action_type || [];

  const getAction = (type: string) => getActionValue(actions, type);
  const getCostPerAction = (type: string) => getActionValue(costPerAction, type);

  const spend = parseFloat(row.spend || "0");
  const impressions = parseInt(row.impressions || "0", 10);
  const reach = parseInt(row.reach || "0", 10);
  const clicks = parseInt(row.clicks || "0", 10);

  const leads = getAction("lead") + getAction("onsite_conversion.lead_grouped");
  const linkClicks = getAction("link_click");
  const searches = getAction("search");
  const contacts = getAction("contact") + getAction("onsite_conversion.messaging_conversation_started_7d");

  const results = leads;
  const resultRate = impressions > 0 ? (results / impressions) * 100 : 0;
  const costPerResult = results > 0 ? spend / results : 0;
  const costPerLead = leads > 0 ? spend / leads : 0;
  const landingPageConversionRate = linkClicks > 0 ? (leads / linkClicks) * 100 : 0;
  const costPerCall = searches > 0 ? spend / searches : 0;
  const callRate = leads > 0 ? (searches / leads) * 100 : 0;
  const costPerContact = contacts > 0 ? spend / contacts : 0;
  const contactRate = leads > 0 ? (contacts / leads) * 100 : 0;
  const costPer1000Reached = reach > 0 ? (spend / reach) * 1000 : 0;

  const outboundClicks = getActionValue(row.outbound_clicks, "outbound_click");
  const costPerOutboundClick = getActionValue(row.cost_per_outbound_click, "outbound_click");
  const outboundCtr = getActionValue(row.outbound_clicks_ctr, "outbound_click");

  const thruPlays = getVideoActionValue(row.video_thru_play_actions);
  const costPerThruPlay = getVideoActionValue(row.cost_per_thru_play);
  const videoPlays = getVideoActionValue(row.video_play_actions);
  const videoAvgPlayTime = getVideoActionValue(row.video_avg_time_watched_actions);
  const videoP25 = getVideoActionValue(row.video_p25_watched_actions);
  const videoP50 = getVideoActionValue(row.video_p50_watched_actions);
  const videoP75 = getVideoActionValue(row.video_p75_watched_actions);
  const videoP95 = getVideoActionValue(row.video_p95_watched_actions);
  const videoP100 = getVideoActionValue(row.video_p100_watched_actions);
  const video2SecPlays = getVideoActionValue(row.video_continuous_2_sec_watched_actions);
  const costPer2SecPlay = video2SecPlays > 0 ? spend / video2SecPlays : 0;
  const video3SecPlays = getVideoActionValue(row.video_30_sec_watched_actions) || getAction("video_view");
  const costPer3SecPlay = video3SecPlays > 0 ? spend / video3SecPlays : 0;
  const video3SecRate = impressions > 0 ? (video3SecPlays / impressions) * 100 : 0;

  const result: NormalizedInsight = {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    adsetId: row.adset_id,
    adsetName: row.adset_name,
    adId: row.ad_id,
    adName: row.ad_name,
    spend,
    impressions,
    reach,
    clicks,
    cpc: parseFloat(row.cpc || "0"),
    cpm: parseFloat(row.cpm || "0"),
    ctr: parseFloat(row.ctr || "0"),
    frequency: parseFloat(row.frequency || "0"),
    leads,
    costPerLead,
    purchases: getAction("purchase") + getAction("omni_purchase"),
    costPerPurchase: getCostPerAction("purchase") || getCostPerAction("omni_purchase"),
    linkClicks,
    results,
    resultRate,
    costPerResult,
    outboundClicks,
    costPerOutboundClick,
    outboundCtr,
    thruPlays,
    costPerThruPlay,
    videoPlays,
    videoAvgPlayTime,
    videoP25,
    videoP50,
    videoP75,
    videoP95,
    videoP100,
    video2SecPlays,
    costPer2SecPlay,
    video3SecPlays,
    costPer3SecPlay,
    video3SecRate,
    searches,
    costPerCall,
    callRate,
    contacts,
    costPerContact,
    contactRate,
    landingPageConversionRate,
    costPer1000Reached,
    qualityRanking: row.quality_ranking || "",
    engagementRateRanking: row.engagement_rate_ranking || "",
    conversionRateRanking: row.conversion_rate_ranking || "",
    dateStart: row.date_start,
    dateStop: row.date_stop,
  };

  if (includeRaw) {
    result.rawActions = actions;
    result.rawCostPerAction = costPerAction;
  }

  return result;
}

const INSIGHT_FIELDS = [
  "spend", "impressions", "reach", "clicks", "cpc", "cpm", "ctr", "frequency",
  "actions", "cost_per_action_type",
  "outbound_clicks", "cost_per_outbound_click", "outbound_clicks_ctr",
  "video_thru_play_actions", "cost_per_thru_play",
  "video_play_actions", "video_avg_time_watched_actions",
  "video_p25_watched_actions", "video_p50_watched_actions",
  "video_p75_watched_actions", "video_p95_watched_actions", "video_p100_watched_actions",
  "video_continuous_2_sec_watched_actions", "video_30_sec_watched_actions",
  "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking",
].join(",");

export async function getAccountInsights(
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<NormalizedInsight[]> {
  const rows = await paginatedFetch<InsightRow>(`/${adAccountId}/insights`, {
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    limit: 500,
  });
  return rows.map(r => normalizeInsight(r));
}

export async function getCampaignInsights(
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<NormalizedInsight[]> {
  const rows = await paginatedFetch<InsightRow>(`/${adAccountId}/insights`, {
    fields: `campaign_id,campaign_name,${INSIGHT_FIELDS}`,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    level: "campaign",
    limit: 500,
  });
  return rows.map(r => normalizeInsight(r));
}

export async function getAdsetInsights(
  adAccountId: string,
  campaignId: string,
  startDate: string,
  endDate: string
): Promise<NormalizedInsight[]> {
  const rows = await paginatedFetch<InsightRow>(`/${adAccountId}/insights`, {
    fields: `adset_id,adset_name,campaign_id,${INSIGHT_FIELDS}`,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    level: "adset",
    filtering: JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaignId }]),
    limit: 500,
  });
  return rows.map(r => normalizeInsight(r));
}

export async function getAdInsights(
  adAccountId: string,
  adsetId: string,
  startDate: string,
  endDate: string
): Promise<NormalizedInsight[]> {
  const rows = await paginatedFetch<InsightRow>(`/${adAccountId}/insights`, {
    fields: `ad_id,ad_name,adset_id,${INSIGHT_FIELDS}`,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    level: "ad",
    filtering: JSON.stringify([{ field: "adset.id", operator: "EQUAL", value: adsetId }]),
    limit: 500,
  });
  return rows.map(r => normalizeInsight(r));
}

export async function getAdInsightsAll(
  adAccountId: string,
  startDate: string,
  endDate: string,
  includeRaw = false
): Promise<NormalizedInsight[]> {
  const rows = await paginatedFetch<InsightRow>(`/${adAccountId}/insights`, {
    fields: `ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,${INSIGHT_FIELDS}`,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    level: "ad",
    limit: 500,
  });
  return rows.map(r => normalizeInsight(r, includeRaw));
}

export async function getDailyInsights(
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<NormalizedInsight[]> {
  const rows = await paginatedFetch<InsightRow>(`/${adAccountId}/insights`, {
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    time_increment: 1,
    limit: 500,
  });
  return rows.map(r => normalizeInsight(r));
}

export async function getDailyCampaignInsights(
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<NormalizedInsight[]> {
  const rows = await paginatedFetch<InsightRow>(`/${adAccountId}/insights`, {
    fields: `campaign_id,campaign_name,${INSIGHT_FIELDS}`,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    level: "campaign",
    time_increment: 1,
    limit: 500,
  });
  return rows.map(r => normalizeInsight(r));
}

export function isConfigured(): boolean {
  return !!ACCESS_TOKEN;
}

export interface TokenRefreshResult {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function refreshAccessToken(): Promise<TokenRefreshResult> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const currentToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!appId || !appSecret || !currentToken) {
    throw new FacebookApiError(
      "Missing FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, or FACEBOOK_ACCESS_TOKEN",
      400,
      400
    );
  }

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("set_token_expires_in_60_days", "true");
  url.searchParams.set("fb_exchange_token", currentToken);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { error: { message: text } }; }
    throw new FacebookApiError(
      parsed?.error?.message || text,
      parsed?.error?.code || response.status,
      response.status
    );
  }

  return response.json() as Promise<TokenRefreshResult>;
}

export async function revokeAccessToken(tokenToRevoke: string): Promise<boolean> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const currentToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!appId || !appSecret || !currentToken) {
    throw new FacebookApiError(
      "Missing FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, or FACEBOOK_ACCESS_TOKEN",
      400,
      400
    );
  }

  const url = new URL(`${GRAPH_API_BASE}/oauth/revoke`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("revoke_token", tokenToRevoke);
  url.searchParams.set("access_token", currentToken);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { error: { message: text } }; }
    throw new FacebookApiError(
      parsed?.error?.message || text,
      parsed?.error?.code || response.status,
      response.status
    );
  }

  const result = await response.json();
  return result.success === true || result.success === "true";
}
