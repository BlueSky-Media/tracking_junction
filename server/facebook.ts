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
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
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
  dateStart: string;
  dateStop: string;
}

function normalizeInsight(row: InsightRow): NormalizedInsight {
  const actions = row.actions || [];
  const costPerAction = row.cost_per_action_type || [];

  const getAction = (type: string) =>
    parseInt(actions.find(a => a.action_type === type)?.value || "0", 10);
  const getCostPerAction = (type: string) =>
    parseFloat(costPerAction.find(a => a.action_type === type)?.value || "0");

  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    adsetId: row.adset_id,
    adsetName: row.adset_name,
    adId: row.ad_id,
    adName: row.ad_name,
    spend: parseFloat(row.spend || "0"),
    impressions: parseInt(row.impressions || "0", 10),
    reach: parseInt(row.reach || "0", 10),
    clicks: parseInt(row.clicks || "0", 10),
    cpc: parseFloat(row.cpc || "0"),
    cpm: parseFloat(row.cpm || "0"),
    ctr: parseFloat(row.ctr || "0"),
    frequency: parseFloat(row.frequency || "0"),
    leads: getAction("lead") + getAction("onsite_conversion.lead_grouped"),
    costPerLead: getCostPerAction("lead") || getCostPerAction("onsite_conversion.lead_grouped"),
    purchases: getAction("purchase") + getAction("omni_purchase"),
    costPerPurchase: getCostPerAction("purchase") || getCostPerAction("omni_purchase"),
    linkClicks: getAction("link_click"),
    dateStart: row.date_start,
    dateStop: row.date_stop,
  };
}

const INSIGHT_FIELDS = "spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,cost_per_action_type";

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
  return rows.map(normalizeInsight);
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
  return rows.map(normalizeInsight);
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
  return rows.map(normalizeInsight);
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
  return rows.map(normalizeInsight);
}

export async function getAdInsightsAll(
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<NormalizedInsight[]> {
  const rows = await paginatedFetch<InsightRow>(`/${adAccountId}/insights`, {
    fields: `ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,${INSIGHT_FIELDS}`,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    level: "ad",
    limit: 500,
  });
  return rows.map(normalizeInsight);
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
  return rows.map(normalizeInsight);
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
