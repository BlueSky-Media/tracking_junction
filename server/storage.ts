import {
  trackingEvents,
  requestLogs,
  blockedNumbers,
  type InsertTrackingEvent,
  type TrackingEvent,
  type InsertRequestLog,
  type RequestLog,
  type BlockedNumber,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, count, countDistinct, desc, avg, isNotNull, ne, ilike, or, inArray } from "drizzle-orm";

export interface AnalyticsFilters {
  page?: string | string[];
  pageType?: string | string[];
  domain?: string | string[];
  startDate?: string;
  endDate?: string;
  utmSource?: string | string[];
  utmCampaign?: string | string[];
  utmMedium?: string | string[];
  utmContent?: string | string[];
  deviceType?: string | string[];
  os?: string | string[];
  browser?: string | string[];
  geoState?: string | string[];
}

interface FunnelStep {
  stepNumber: number;
  stepName: string;
  uniqueVisitors: number;
  conversionRate: number;
  dropOffRate: number;
  avgTimeOnStep: number | null;
}

interface StepOption {
  value: string;
  count: number;
  percentage: number;
}

interface StepBreakdownData {
  stepNumber: number;
  stepName: string;
  totalResponses: number;
  options: StepOption[];
}

interface StatsData {
  totalSessions: number;
  totalEvents: number;
  overallConversion: number;
  avgStepsCompleted: number;
  bounceRate: number;
}

interface BounceData {
  totalVisitors: number;
  bouncedVisitors: number;
  bounceRate: number;
}

interface CampaignRow {
  campaign: string;
  source: string;
  medium: string;
  sessions: number;
  completions: number;
  conversionRate: number;
  bounces: number;
  bounceRate: number;
}

interface DeviceRow {
  deviceType: string;
  sessions: number;
  completions: number;
  conversionRate: number;
}

interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  sessions: number;
  conversions: number;
  conversionRate: number;
}

interface ContactFunnelStep {
  stepName: string;
  uniqueVisitors: number;
  conversionRate: number;
  dropOffRate: number;
}

interface ReferrerRow {
  referrer: string;
  sessions: number;
  completions: number;
  conversionRate: number;
}

interface DrilldownStepData {
  stepNumber: number;
  stepName: string;
  stepKey: string;
  completions: number;
  conversionFromPrev: number;
  conversionFromInitial: number;
}

interface DrilldownRow {
  groupValue: string;
  uniqueViews: number;
  grossViews: number;
  pageLands: number;
  formCompletions: number;
  steps: DrilldownStepData[];
}

interface DrilldownResult {
  rows: DrilldownRow[];
  totals: DrilldownRow;
  groupBy: string;
}

interface EventLogResult {
  events: TrackingEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IStorage {
  insertEvent(event: InsertTrackingEvent): Promise<TrackingEvent>;
  insertEventsBatch(events: InsertTrackingEvent[]): Promise<void>;
  getStats(filters: AnalyticsFilters): Promise<StatsData>;
  getFunnel(filters: AnalyticsFilters): Promise<{ steps: FunnelStep[] }>;
  getBreakdown(filters: AnalyticsFilters): Promise<StepBreakdownData[]>;
  getBounceRate(filters: AnalyticsFilters): Promise<BounceData>;
  getCampaignComparison(filters: AnalyticsFilters): Promise<CampaignRow[]>;
  getDeviceBreakdown(filters: AnalyticsFilters): Promise<DeviceRow[]>;
  getTimeHeatmap(filters: AnalyticsFilters): Promise<HeatmapCell[]>;
  getContactFormFunnel(filters: AnalyticsFilters): Promise<{ steps: ContactFunnelStep[] }>;
  getReferrerBreakdown(filters: AnalyticsFilters): Promise<ReferrerRow[]>;
  getFilterOptions(): Promise<{ utmSources: string[]; utmCampaigns: string[]; utmMediums: string[]; osList: string[]; browsers: string[]; geoStates: string[] }>;
  exportCsv(filters: AnalyticsFilters): Promise<string>;
  getDrilldown(filters: AnalyticsFilters, groupBy: string): Promise<DrilldownResult>;
  getEventLogs(filters: AnalyticsFilters, page: number, limit: number, search?: string): Promise<EventLogResult>;
  deleteAllEvents(): Promise<void>;
  deleteEvent(id: number): Promise<void>;
  deleteEventsBySession(sessionId: string): Promise<number>;
  deleteEventsBySessions(sessionIds: string[]): Promise<number>;
  getSessionLogs(filters: AnalyticsFilters, page: number, limit: number, search?: string): Promise<{
    sessions: {
      sessionId: string;
      events: TrackingEvent[];
      maxStep: number;
      maxStepName: string;
      maxEventType: string;
      eventCount: number;
      firstEventAt: Date;
      lastEventAt: Date;
      page: string;
      pageType: string;
      domain: string;
      deviceType: string | null;
      os: string | null;
      browser: string | null;
      utmSource: string | null;
      utmCampaign: string | null;
      utmMedium: string | null;
      geoState: string | null;
      referrer: string | null;
      pageUrl: string | null;
      screenResolution: string | null;
      viewport: string | null;
      language: string | null;
      selectedState: string | null;
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  insertRequestLog(log: InsertRequestLog): Promise<RequestLog>;
  getRequestLogs(filters: {
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    statusCode?: number;
    eventType?: string;
    domain?: string;
    search?: string;
  }, page: number, limit: number): Promise<{ logs: RequestLog[]; total: number; page: number; limit: number; totalPages: number }>;
  deleteRequestLogs(beforeDate?: string): Promise<number>;
  getBlockedNumbers(): Promise<BlockedNumber[]>;
  isPhoneBlocked(phone: string): Promise<boolean>;
  blockPhone(phone: string, reason?: string): Promise<BlockedNumber>;
  unblockPhone(phone: string): Promise<void>;
  bulkUnblockPhones(phones: string[]): Promise<number>;
}

function addFilterCondition(conditions: any[], column: any, value: string | string[] | undefined) {
  if (!value) return;
  if (Array.isArray(value)) {
    if (value.length === 1) conditions.push(eq(column, value[0]));
    else if (value.length > 1) conditions.push(inArray(column, value));
  } else {
    conditions.push(eq(column, value));
  }
}

function buildConditions(filters: AnalyticsFilters) {
  const conditions: any[] = [];
  addFilterCondition(conditions, trackingEvents.page, filters.page);
  addFilterCondition(conditions, trackingEvents.pageType, filters.pageType);
  addFilterCondition(conditions, trackingEvents.domain, filters.domain);
  if (filters.startDate) conditions.push(gte(trackingEvents.eventTimestamp, new Date(filters.startDate)));
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(trackingEvents.eventTimestamp, end));
  }
  addFilterCondition(conditions, trackingEvents.utmSource, filters.utmSource);
  addFilterCondition(conditions, trackingEvents.utmCampaign, filters.utmCampaign);
  addFilterCondition(conditions, trackingEvents.utmMedium, filters.utmMedium);
  addFilterCondition(conditions, trackingEvents.utmContent, filters.utmContent);
  addFilterCondition(conditions, trackingEvents.deviceType, filters.deviceType);
  addFilterCondition(conditions, trackingEvents.os, filters.os);
  addFilterCondition(conditions, trackingEvents.browser, filters.browser);
  addFilterCondition(conditions, trackingEvents.geoState, filters.geoState);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function stepCompleteCondition() {
  return sql`(${trackingEvents.eventType} = 'step_complete' OR ${trackingEvents.eventType} IS NULL)`;
}

class DatabaseStorage implements IStorage {
  async insertEvent(event: InsertTrackingEvent): Promise<TrackingEvent> {
    const [result] = await db.insert(trackingEvents).values(event as any).returning();
    return result;
  }

  async insertEventsBatch(events: InsertTrackingEvent[]): Promise<void> {
    if (events.length === 0) return;
    await db.insert(trackingEvents).values(events as any);
  }

  async getStats(filters: AnalyticsFilters): Promise<StatsData> {
    const where = buildConditions(filters);

    const [result] = await db
      .select({
        totalSessions: countDistinct(trackingEvents.sessionId),
        totalEvents: count(),
      })
      .from(trackingEvents)
      .where(where);

    const totalSessions = Number(result?.totalSessions || 0);
    const totalEvents = Number(result?.totalEvents || 0);

    if (totalSessions === 0) {
      return { totalSessions: 0, totalEvents: 0, overallConversion: 0, avgStepsCompleted: 0, bounceRate: 0 };
    }

    const completedSessions = await db
      .select({
        completed: countDistinct(trackingEvents.sessionId),
      })
      .from(trackingEvents)
      .where(and(
        where,
        sql`(
          ${trackingEvents.eventType} = 'form_complete'
          OR
          (${trackingEvents.pageType} = 'call' AND ${trackingEvents.stepNumber} >= 5)
        )`
      ));

    const completed = Number(completedSessions[0]?.completed || 0);
    const overallConversion = totalSessions > 0 ? (completed / totalSessions) * 100 : 0;

    const avgResult = await db
      .select({
        sessionId: trackingEvents.sessionId,
        maxStep: sql<number>`max(${trackingEvents.stepNumber})`.as("max_step"),
      })
      .from(trackingEvents)
      .where(and(where, stepCompleteCondition()))
      .groupBy(trackingEvents.sessionId);

    const avgStepsCompleted =
      avgResult.length > 0
        ? avgResult.reduce((sum, r) => sum + (r.maxStep || 0), 0) / avgResult.length
        : 0;

    const bounceData = await this.getBounceRate(filters);

    return { totalSessions, totalEvents, overallConversion, avgStepsCompleted, bounceRate: bounceData.bounceRate };
  }

  async getFunnel(filters: AnalyticsFilters): Promise<{ steps: FunnelStep[] }> {
    const where = buildConditions(filters);

    const stepsData = await db
      .select({
        stepNumber: trackingEvents.stepNumber,
        stepName: trackingEvents.stepName,
        uniqueVisitors: countDistinct(trackingEvents.sessionId),
        avgTime: avg(trackingEvents.timeOnStep),
      })
      .from(trackingEvents)
      .where(and(where, stepCompleteCondition()))
      .groupBy(trackingEvents.stepNumber, trackingEvents.stepName)
      .orderBy(trackingEvents.stepNumber);

    if (stepsData.length === 0) {
      return { steps: [] };
    }

    const firstStepVisitors = Number(stepsData[0]?.uniqueVisitors || 1);

    const steps: FunnelStep[] = stepsData.map((step, idx) => {
      const visitors = Number(step.uniqueVisitors);
      const prevVisitors = idx > 0 ? Number(stepsData[idx - 1].uniqueVisitors) : visitors;
      const dropOffRate = idx > 0 ? ((prevVisitors - visitors) / prevVisitors) * 100 : 0;
      const conversionRate = (visitors / firstStepVisitors) * 100;

      return {
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        uniqueVisitors: visitors,
        conversionRate,
        dropOffRate,
        avgTimeOnStep: step.avgTime ? Math.round(Number(step.avgTime)) : null,
      };
    });

    return { steps };
  }

  async getBreakdown(filters: AnalyticsFilters): Promise<StepBreakdownData[]> {
    const where = buildConditions(filters);

    const rawData = await db
      .select({
        stepNumber: trackingEvents.stepNumber,
        stepName: trackingEvents.stepName,
        selectedValue: trackingEvents.selectedValue,
        uniqueCount: countDistinct(trackingEvents.sessionId),
      })
      .from(trackingEvents)
      .where(and(where, stepCompleteCondition(), sql`${trackingEvents.selectedValue} IS NOT NULL AND ${trackingEvents.selectedValue} != ''`))
      .groupBy(trackingEvents.stepNumber, trackingEvents.stepName, trackingEvents.selectedValue)
      .orderBy(trackingEvents.stepNumber, desc(countDistinct(trackingEvents.sessionId)));

    const stepMap = new Map<number, StepBreakdownData>();

    for (const row of rawData) {
      const existing = stepMap.get(row.stepNumber);
      const c = Number(row.uniqueCount);
      if (existing) {
        existing.totalResponses += c;
        existing.options.push({ value: row.selectedValue || "Unknown", count: c, percentage: 0 });
      } else {
        stepMap.set(row.stepNumber, {
          stepNumber: row.stepNumber,
          stepName: row.stepName,
          totalResponses: c,
          options: [{ value: row.selectedValue || "Unknown", count: c, percentage: 0 }],
        });
      }
    }

    const result = Array.from(stepMap.values()).sort((a, b) => a.stepNumber - b.stepNumber);

    for (const step of result) {
      for (const option of step.options) {
        option.percentage = step.totalResponses > 0 ? (option.count / step.totalResponses) * 100 : 0;
      }
    }

    return result;
  }

  async getBounceRate(filters: AnalyticsFilters): Promise<BounceData> {
    const where = buildConditions(filters);

    const [totalResult] = await db
      .select({ total: countDistinct(trackingEvents.sessionId) })
      .from(trackingEvents)
      .where(where);

    const totalVisitors = Number(totalResult?.total || 0);

    if (totalVisitors === 0) {
      return { totalVisitors: 0, bouncedVisitors: 0, bounceRate: 0 };
    }

    const bouncedResult = await db.execute(sql`
      SELECT COUNT(*) as bounced FROM (
        SELECT ${trackingEvents.sessionId},
          MAX(CASE WHEN ${trackingEvents.eventType} = 'page_land' THEN 1 ELSE 0 END) as has_land,
          MAX(CASE WHEN ${trackingEvents.eventType} = 'step_complete' OR ${trackingEvents.eventType} IS NULL THEN 1 ELSE 0 END) as has_step
        FROM ${trackingEvents}
        ${where ? sql`WHERE ${where}` : sql``}
        GROUP BY ${trackingEvents.sessionId}
        HAVING MAX(CASE WHEN ${trackingEvents.eventType} = 'step_complete' OR ${trackingEvents.eventType} IS NULL THEN 1 ELSE 0 END) = 0
      ) bounced_sessions
    `);

    const bouncedVisitors = Number((bouncedResult as any).rows?.[0]?.bounced || 0);
    const bounceRate = totalVisitors > 0 ? (bouncedVisitors / totalVisitors) * 100 : 0;

    return { totalVisitors, bouncedVisitors, bounceRate };
  }

  async getCampaignComparison(filters: AnalyticsFilters): Promise<CampaignRow[]> {
    const where = buildConditions(filters);

    const rows = await db.execute(sql`
      SELECT
        COALESCE(${trackingEvents.utmCampaign}, '(none)') as campaign,
        COALESCE(${trackingEvents.utmSource}, '(none)') as source,
        COALESCE(${trackingEvents.utmMedium}, '(none)') as medium,
        COUNT(DISTINCT ${trackingEvents.sessionId}) as sessions,
        COUNT(DISTINCT CASE
          WHEN ${trackingEvents.eventType} = 'form_complete'
            OR (${trackingEvents.pageType} = 'call' AND ${trackingEvents.stepNumber} >= 5)
          THEN ${trackingEvents.sessionId}
        END) as completions
      FROM ${trackingEvents}
      ${where ? sql`WHERE ${where}` : sql``}
      GROUP BY COALESCE(${trackingEvents.utmCampaign}, '(none)'),
               COALESCE(${trackingEvents.utmSource}, '(none)'),
               COALESCE(${trackingEvents.utmMedium}, '(none)')
      ORDER BY sessions DESC
      LIMIT 50
    `);

    const results = (rows as any).rows || [];
    return results.map((r: any) => ({
      campaign: r.campaign,
      source: r.source,
      medium: r.medium,
      sessions: Number(r.sessions),
      completions: Number(r.completions),
      conversionRate: Number(r.sessions) > 0 ? (Number(r.completions) / Number(r.sessions)) * 100 : 0,
      bounces: 0,
      bounceRate: 0,
    }));
  }

  async getDeviceBreakdown(filters: AnalyticsFilters): Promise<DeviceRow[]> {
    const where = buildConditions(filters);

    const rows = await db.execute(sql`
      SELECT
        COALESCE(${trackingEvents.deviceType}, 'unknown') as device_type,
        COUNT(DISTINCT ${trackingEvents.sessionId}) as sessions,
        COUNT(DISTINCT CASE
          WHEN ${trackingEvents.eventType} = 'form_complete'
            OR (${trackingEvents.pageType} = 'call' AND ${trackingEvents.stepNumber} >= 5)
          THEN ${trackingEvents.sessionId}
        END) as completions
      FROM ${trackingEvents}
      ${where ? sql`WHERE ${where}` : sql``}
      GROUP BY COALESCE(${trackingEvents.deviceType}, 'unknown')
      ORDER BY sessions DESC
    `);

    const results = (rows as any).rows || [];
    return results.map((r: any) => ({
      deviceType: r.device_type,
      sessions: Number(r.sessions),
      completions: Number(r.completions),
      conversionRate: Number(r.sessions) > 0 ? (Number(r.completions) / Number(r.sessions)) * 100 : 0,
    }));
  }

  async getTimeHeatmap(filters: AnalyticsFilters): Promise<HeatmapCell[]> {
    const where = buildConditions(filters);

    const rows = await db.execute(sql`
      SELECT
        EXTRACT(DOW FROM ${trackingEvents.eventTimestamp})::int as day_of_week,
        EXTRACT(HOUR FROM ${trackingEvents.eventTimestamp})::int as hour,
        COUNT(DISTINCT ${trackingEvents.sessionId}) as sessions,
        COUNT(DISTINCT CASE
          WHEN ${trackingEvents.eventType} = 'form_complete'
            OR (${trackingEvents.pageType} = 'call' AND ${trackingEvents.stepNumber} >= 5)
          THEN ${trackingEvents.sessionId}
        END) as conversions
      FROM ${trackingEvents}
      ${where ? sql`WHERE ${where}` : sql``}
      GROUP BY EXTRACT(DOW FROM ${trackingEvents.eventTimestamp}),
               EXTRACT(HOUR FROM ${trackingEvents.eventTimestamp})
      ORDER BY day_of_week, hour
    `);

    const results = (rows as any).rows || [];
    return results.map((r: any) => ({
      dayOfWeek: Number(r.day_of_week),
      hour: Number(r.hour),
      sessions: Number(r.sessions),
      conversions: Number(r.conversions),
      conversionRate: Number(r.sessions) > 0 ? (Number(r.conversions) / Number(r.sessions)) * 100 : 0,
    }));
  }

  async getContactFormFunnel(filters: AnalyticsFilters): Promise<{ steps: ContactFunnelStep[] }> {
    const where = buildConditions(filters);

    const contactSteps = ["Name", "Email", "Phone"];

    const stepsData = await db
      .select({
        stepName: trackingEvents.stepName,
        uniqueVisitors: countDistinct(trackingEvents.sessionId),
      })
      .from(trackingEvents)
      .where(and(
        where,
        eq(trackingEvents.pageType, "lead"),
        stepCompleteCondition(),
        sql`${trackingEvents.stepName} IN ('Name', 'Email', 'Phone')`
      ))
      .groupBy(trackingEvents.stepName);

    const stepMap = new Map<string, number>();
    for (const row of stepsData) {
      stepMap.set(row.stepName, Number(row.uniqueVisitors));
    }

    const orderedSteps = contactSteps.map((name) => stepMap.get(name) || 0);

    if (orderedSteps.every(v => v === 0)) {
      return { steps: [] };
    }

    const firstStepVisitors = orderedSteps[0] || 1;

    const steps: ContactFunnelStep[] = contactSteps.map((name, idx) => {
      const visitors = orderedSteps[idx];
      const prevVisitors = idx > 0 ? orderedSteps[idx - 1] : visitors;
      return {
        stepName: name,
        uniqueVisitors: visitors,
        conversionRate: (visitors / firstStepVisitors) * 100,
        dropOffRate: idx > 0 && prevVisitors > 0 ? ((prevVisitors - visitors) / prevVisitors) * 100 : 0,
      };
    });

    return { steps };
  }

  async getReferrerBreakdown(filters: AnalyticsFilters): Promise<ReferrerRow[]> {
    const where = buildConditions(filters);

    const rows = await db.execute(sql`
      SELECT
        COALESCE(${trackingEvents.referrer}, '(direct)') as referrer,
        COUNT(DISTINCT ${trackingEvents.sessionId}) as sessions,
        COUNT(DISTINCT CASE
          WHEN ${trackingEvents.eventType} = 'form_complete'
            OR (${trackingEvents.pageType} = 'call' AND ${trackingEvents.stepNumber} >= 5)
          THEN ${trackingEvents.sessionId}
        END) as completions
      FROM ${trackingEvents}
      ${where ? sql`WHERE ${where}` : sql``}
      GROUP BY COALESCE(${trackingEvents.referrer}, '(direct)')
      ORDER BY sessions DESC
      LIMIT 20
    `);

    const results = (rows as any).rows || [];
    return results.map((r: any) => ({
      referrer: r.referrer,
      sessions: Number(r.sessions),
      completions: Number(r.completions),
      conversionRate: Number(r.sessions) > 0 ? (Number(r.completions) / Number(r.sessions)) * 100 : 0,
    }));
  }

  async getFilterOptions(): Promise<{
    utmSources: string[]; utmCampaigns: string[]; utmMediums: string[];
    osList: string[]; browsers: string[]; geoStates: string[];
  }> {
    const [sources, campaigns, mediums, osList, browsers, geoStates] = await Promise.all([
      db.selectDistinct({ val: trackingEvents.utmSource })
        .from(trackingEvents)
        .where(isNotNull(trackingEvents.utmSource))
        .orderBy(trackingEvents.utmSource)
        .limit(100),
      db.selectDistinct({ val: trackingEvents.utmCampaign })
        .from(trackingEvents)
        .where(isNotNull(trackingEvents.utmCampaign))
        .orderBy(trackingEvents.utmCampaign)
        .limit(100),
      db.selectDistinct({ val: trackingEvents.utmMedium })
        .from(trackingEvents)
        .where(isNotNull(trackingEvents.utmMedium))
        .orderBy(trackingEvents.utmMedium)
        .limit(100),
      db.selectDistinct({ val: trackingEvents.os })
        .from(trackingEvents)
        .where(isNotNull(trackingEvents.os))
        .orderBy(trackingEvents.os)
        .limit(50),
      db.selectDistinct({ val: trackingEvents.browser })
        .from(trackingEvents)
        .where(isNotNull(trackingEvents.browser))
        .orderBy(trackingEvents.browser)
        .limit(50),
      db.selectDistinct({ val: trackingEvents.geoState })
        .from(trackingEvents)
        .where(isNotNull(trackingEvents.geoState))
        .orderBy(trackingEvents.geoState)
        .limit(60),
    ]);

    return {
      utmSources: sources.map(s => s.val!).filter(Boolean),
      utmCampaigns: campaigns.map(s => s.val!).filter(Boolean),
      utmMediums: mediums.map(s => s.val!).filter(Boolean),
      osList: osList.map(s => s.val!).filter(Boolean),
      browsers: browsers.map(s => s.val!).filter(Boolean),
      geoStates: geoStates.map(s => s.val!).filter(Boolean),
    };
  }

  async exportCsv(filters: AnalyticsFilters): Promise<string> {
    const where = buildConditions(filters);

    const rows = await db
      .select()
      .from(trackingEvents)
      .where(where)
      .orderBy(desc(trackingEvents.eventTimestamp))
      .limit(10000);

    const headers = [
      "id", "session_id", "event_id", "event_type", "page", "page_type", "domain",
      "step_number", "step_name", "selected_value", "time_on_step",
      "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term", "utm_id",
      "device_type", "os", "browser", "geo_state", "ip_address", "placement",
      "media_type", "campaign_name", "campaign_id", "ad_name", "ad_id",
      "adset_name", "adset_id", "fbclid", "fbc", "fbp", "external_id",
      "quiz_answers", "referrer",
      "first_name", "last_name", "email", "phone", "event_timestamp"
    ];

    const csvRows = [headers.join(",")];

    for (const row of rows) {
      const values = [
        row.id,
        row.sessionId,
        row.eventId || "",
        row.eventType || "step_complete",
        row.page,
        row.pageType,
        row.domain,
        row.stepNumber,
        `"${(row.stepName || '').replace(/"/g, '""')}"`,
        `"${(row.selectedValue || '').replace(/"/g, '""')}"`,
        row.timeOnStep ?? "",
        row.utmSource || "",
        `"${(row.utmCampaign || '').replace(/"/g, '""')}"`,
        row.utmMedium || "",
        `"${(row.utmContent || '').replace(/"/g, '""')}"`,
        row.utmTerm || "",
        row.utmId || "",
        row.deviceType || "",
        row.os || "",
        row.browser || "",
        row.geoState || "",
        row.ipAddress || "",
        `"${(row.placement || '').replace(/"/g, '""')}"`,
        row.mediaType || "",
        `"${(row.campaignName || '').replace(/"/g, '""')}"`,
        row.campaignId || "",
        `"${(row.adName || '').replace(/"/g, '""')}"`,
        row.adId || "",
        `"${(row.adsetName || '').replace(/"/g, '""')}"`,
        row.adsetId || "",
        `"${(row.fbclid || '').replace(/"/g, '""')}"`,
        `"${(row.fbc || '').replace(/"/g, '""')}"`,
        `"${(row.fbp || '').replace(/"/g, '""')}"`,
        row.externalId || "",
        `"${JSON.stringify(row.quizAnswers || {}).replace(/"/g, '""')}"`,
        `"${(row.referrer || '').replace(/"/g, '""')}"`,
        `"${(row.firstName || '').replace(/"/g, '""')}"`,
        `"${(row.lastName || '').replace(/"/g, '""')}"`,
        `"${(row.email || '').replace(/"/g, '""')}"`,
        row.phone || "",
        row.eventTimestamp?.toISOString() || "",
      ];
      csvRows.push(values.join(","));
    }

    return csvRows.join("\n");
  }

  async getDrilldown(filters: AnalyticsFilters, groupBy: string): Promise<DrilldownResult> {
    const where = buildConditions(filters);

    const groupColumn: Record<string, any> = {
      domain: sql`COALESCE(${trackingEvents.domain}, '(unknown)')`,
      deviceType: sql`COALESCE(${trackingEvents.deviceType}, '(unknown)')`,
      utmSource: sql`COALESCE(${trackingEvents.utmSource}, '(none)')`,
      utmCampaign: sql`COALESCE(${trackingEvents.utmCampaign}, '(none)')`,
      utmMedium: sql`COALESCE(${trackingEvents.utmMedium}, '(none)')`,
      page: sql`COALESCE(${trackingEvents.page}, '(unknown)')`,
      geoState: sql`COALESCE(${trackingEvents.geoState}, '(unknown)')`,
    };

    const groupCol = groupColumn[groupBy] || groupColumn.domain;

    const rows = await db.execute(sql`
      WITH grouped_steps AS (
        SELECT
          ${groupCol} as group_value,
          ${trackingEvents.sessionId},
          ${trackingEvents.stepNumber},
          ${trackingEvents.stepName},
          ${trackingEvents.eventType}
        FROM ${trackingEvents}
        ${where ? sql`WHERE ${where}` : sql``}
      ),
      group_views AS (
        SELECT
          group_value,
          COUNT(DISTINCT session_id) as unique_views,
          COUNT(*) as gross_views
        FROM grouped_steps
        GROUP BY group_value
      ),
      page_lands AS (
        SELECT
          group_value,
          COUNT(DISTINCT session_id) as completions
        FROM grouped_steps
        GROUP BY group_value
      ),
      step_completions AS (
        SELECT
          group_value,
          step_number,
          step_name,
          COUNT(DISTINCT session_id) as completions
        FROM grouped_steps
        WHERE event_type = 'step_complete' OR event_type IS NULL
        GROUP BY group_value, step_number, step_name
      ),
      form_completions AS (
        SELECT
          group_value,
          COUNT(DISTINCT session_id) as completions
        FROM grouped_steps
        WHERE event_type = 'form_complete'
        GROUP BY group_value
      )
      SELECT
        gv.group_value,
        gv.unique_views,
        gv.gross_views,
        COALESCE(pl.completions, 0) as page_lands,
        COALESCE(fc.completions, 0) as form_completions,
        sc.step_number,
        sc.step_name,
        sc.completions
      FROM group_views gv
      LEFT JOIN page_lands pl ON gv.group_value = pl.group_value
      LEFT JOIN form_completions fc ON gv.group_value = fc.group_value
      LEFT JOIN step_completions sc ON gv.group_value = sc.group_value
      ORDER BY gv.unique_views DESC, gv.group_value, sc.step_number
    `);

    const results = (rows as any).rows || [];

    const groupMap = new Map<string, { uniqueViews: number; grossViews: number; pageLands: number; formCompletions: number; stepsMap: Map<string, { stepNumber: number; stepName: string; completions: number }> }>();

    for (const r of results) {
      const gv = r.group_value as string;
      if (!groupMap.has(gv)) {
        groupMap.set(gv, {
          uniqueViews: Number(r.unique_views),
          grossViews: Number(r.gross_views),
          pageLands: Number(r.page_lands || 0),
          formCompletions: Number(r.form_completions || 0),
          stepsMap: new Map(),
        });
      }
      if (r.step_number !== null && r.step_number !== undefined) {
        const sn = Number(r.step_number);
        const sName = r.step_name as string;
        const stepKey = `${sn}:${sName}`;
        const existing = groupMap.get(gv)!.stepsMap.get(stepKey);
        if (existing) {
          existing.completions += Number(r.completions);
        } else {
          groupMap.get(gv)!.stepsMap.set(stepKey, {
            stepNumber: sn,
            stepName: sName,
            completions: Number(r.completions),
          });
        }
      }
    }

    const allStepKeys = new Set<string>();
    Array.from(groupMap.values()).forEach(g => {
      Array.from(g.stepsMap.keys()).forEach(sk => allStepKeys.add(sk));
    });
    const sortedStepKeys = Array.from(allStepKeys).sort((a, b) => {
      const [aNum, ...aName] = a.split(":");
      const [bNum, ...bName] = b.split(":");
      const numDiff = Number(aNum) - Number(bNum);
      if (numDiff !== 0) return numDiff;
      return aName.join(":").localeCompare(bName.join(":"));
    });

    function buildSteps(
      defaultBase: number,
      stepsMap: Map<string, { stepNumber: number; stepName: string; completions: number }>,
      perStepLandBase?: Map<string, number>,
    ): DrilldownStepData[] {
      let prevCount = defaultBase;
      return sortedStepKeys.map((sk) => {
        const stepData = stepsMap.get(sk);
        const completions = stepData?.completions || 0;
        const convFromPrev = prevCount > 0 ? (completions / prevCount) * 100 : 0;
        const landBase = perStepLandBase?.get(sk) ?? defaultBase;
        const convFromInitial = landBase > 0 ? (completions / landBase) * 100 : 0;
        if (completions > 0) prevCount = completions;
        const [numStr, ...nameParts] = sk.split(":");
        return {
          stepNumber: Number(numStr),
          stepName: stepData?.stepName || nameParts.join(":") || `Step ${numStr}`,
          stepKey: sk,
          completions,
          conversionFromPrev: Math.round(convFromPrev * 10) / 10,
          conversionFromInitial: Math.round(convFromInitial * 10) / 10,
        };
      });
    }

    const drilldownRows: DrilldownRow[] = [];
    Array.from(groupMap.entries()).forEach(([gv, data]) => {
      const pageLandBase = data.pageLands || data.uniqueViews;
      drilldownRows.push({
        groupValue: gv,
        uniqueViews: data.uniqueViews,
        grossViews: data.grossViews,
        pageLands: data.pageLands,
        formCompletions: data.formCompletions,
        steps: buildSteps(pageLandBase, data.stepsMap),
      });
    });

    drilldownRows.sort((a, b) => b.uniqueViews - a.uniqueViews);

    const totalUniqueViews = drilldownRows.reduce((s, r) => s + r.uniqueViews, 0);
    const totalGrossViews = drilldownRows.reduce((s, r) => s + r.grossViews, 0);
    const totalPageLands = drilldownRows.reduce((s, r) => s + r.pageLands, 0);
    const totalFormCompletions = drilldownRows.reduce((s, r) => s + r.formCompletions, 0);
    const totalsStepsMap = new Map<string, { stepNumber: number; stepName: string; completions: number }>();
    for (const row of drilldownRows) {
      for (const step of row.steps) {
        const existing = totalsStepsMap.get(step.stepKey);
        if (existing) {
          existing.completions += step.completions;
        } else {
          totalsStepsMap.set(step.stepKey, { stepNumber: step.stepNumber, stepName: step.stepName, completions: step.completions });
        }
      }
    }

    const totalPageLandBase = totalPageLands || totalUniqueViews;

    const perStepLandBase = new Map<string, number>();
    for (const sk of sortedStepKeys) {
      let stepBase = 0;
      for (const row of drilldownRows) {
        const rowStep = row.steps.find(s => s.stepKey === sk && s.completions > 0);
        if (rowStep) {
          stepBase += row.pageLands || row.uniqueViews;
        }
      }
      perStepLandBase.set(sk, stepBase > 0 ? stepBase : totalPageLandBase);
    }

    const totals: DrilldownRow = {
      groupValue: "Totals",
      uniqueViews: totalUniqueViews,
      grossViews: totalGrossViews,
      pageLands: totalPageLands,
      formCompletions: totalFormCompletions,
      steps: buildSteps(totalPageLandBase, totalsStepsMap, perStepLandBase),
    };

    return { rows: drilldownRows, totals, groupBy };
  }

  async getEventLogs(filters: AnalyticsFilters, page: number, limit: number, search?: string): Promise<EventLogResult> {
    const conditions: any[] = [];
    addFilterCondition(conditions, trackingEvents.page, filters.page);
    addFilterCondition(conditions, trackingEvents.pageType, filters.pageType);
    addFilterCondition(conditions, trackingEvents.domain, filters.domain);
    if (filters.startDate) conditions.push(gte(trackingEvents.eventTimestamp, new Date(filters.startDate)));
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(trackingEvents.eventTimestamp, end));
    }
    addFilterCondition(conditions, trackingEvents.utmSource, filters.utmSource);
    addFilterCondition(conditions, trackingEvents.utmCampaign, filters.utmCampaign);
    addFilterCondition(conditions, trackingEvents.utmMedium, filters.utmMedium);
    addFilterCondition(conditions, trackingEvents.deviceType, filters.deviceType);
    addFilterCondition(conditions, trackingEvents.os, filters.os);
    addFilterCondition(conditions, trackingEvents.browser, filters.browser);
    addFilterCondition(conditions, trackingEvents.geoState, filters.geoState);

    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(sql`(
        LOWER(${trackingEvents.sessionId}) LIKE ${searchTerm}
        OR LOWER(COALESCE(${trackingEvents.page}, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(${trackingEvents.stepName}, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(${trackingEvents.selectedValue}, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(${trackingEvents.utmCampaign}, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(${trackingEvents.utmSource}, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(${trackingEvents.domain}, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(${trackingEvents.eventType}, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(${trackingEvents.referrer}, '')) LIKE ${searchTerm}
        OR CAST(${trackingEvents.id} AS TEXT) LIKE ${searchTerm}
      )`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ total: count() })
      .from(trackingEvents)
      .where(where);

    const total = Number(countResult?.total || 0);
    const offset = (page - 1) * limit;

    const events = await db
      .select()
      .from(trackingEvents)
      .where(where)
      .orderBy(desc(trackingEvents.eventTimestamp))
      .limit(limit)
      .offset(offset);

    return {
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteAllEvents(): Promise<void> {
    await db.delete(trackingEvents);
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(trackingEvents).where(eq(trackingEvents.id, id));
  }

  async deleteEventsBySession(sessionId: string): Promise<number> {
    const result = await db.delete(trackingEvents).where(eq(trackingEvents.sessionId, sessionId)).returning({ id: trackingEvents.id });
    return result.length;
  }

  async deleteEventsBySessions(sessionIds: string[]): Promise<number> {
    if (sessionIds.length === 0) return 0;
    const result = await db.delete(trackingEvents).where(
      inArray(trackingEvents.sessionId, sessionIds)
    ).returning({ id: trackingEvents.id });
    return result.length;
  }

  async getSessionLogs(filters: AnalyticsFilters, page: number, limit: number, search?: string) {
    const conditions = buildConditions(filters) ? [buildConditions(filters)!] : [];

    if (search) {
      conditions.push(
        or(
          ilike(trackingEvents.sessionId, `%${search}%`),
          ilike(trackingEvents.stepName, `%${search}%`),
          ilike(trackingEvents.selectedValue, `%${search}%`),
          ilike(trackingEvents.utmCampaign, `%${search}%`),
          ilike(trackingEvents.utmSource, `%${search}%`),
        )!
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sessionCountResult = await db
      .select({ total: countDistinct(trackingEvents.sessionId) })
      .from(trackingEvents)
      .where(where);
    const total = Number(sessionCountResult[0]?.total || 0);

    const offset = (page - 1) * limit;

    const sessionIdRows = await db
      .select({
        sessionId: trackingEvents.sessionId,
        lastEvent: sql<Date>`MAX(${trackingEvents.eventTimestamp})`.as("last_event"),
      })
      .from(trackingEvents)
      .where(where)
      .groupBy(trackingEvents.sessionId)
      .orderBy(desc(sql`MAX(${trackingEvents.eventTimestamp})`))
      .limit(limit)
      .offset(offset);

    const sessionIds = sessionIdRows.map(r => r.sessionId);

    if (sessionIds.length === 0) {
      return { sessions: [], total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const allEvents = await db
      .select()
      .from(trackingEvents)
      .where(sql`${trackingEvents.sessionId} IN (${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(trackingEvents.eventTimestamp, trackingEvents.stepNumber);

    const sessionMap = new Map<string, TrackingEvent[]>();
    for (const event of allEvents) {
      if (!sessionMap.has(event.sessionId)) sessionMap.set(event.sessionId, []);
      sessionMap.get(event.sessionId)!.push(event);
    }

    const sessions = sessionIds.map(sessionId => {
      const events = sessionMap.get(sessionId) || [];
      const maxStepEvent = events.reduce((max, e) => (e.stepNumber > max.stepNumber ? e : max), events[0]);
      const hasFormComplete = events.some(e => e.eventType === "form_complete");
      const firstEvent = events[0];

      return {
        sessionId,
        events,
        maxStep: maxStepEvent.stepNumber,
        maxStepName: maxStepEvent.stepName,
        maxEventType: hasFormComplete ? "form_complete" : maxStepEvent.eventType || "step_complete",
        eventCount: events.length,
        firstEventAt: events.reduce((min, e) => new Date(e.eventTimestamp) < min ? new Date(e.eventTimestamp) : min, new Date(events[0].eventTimestamp)),
        lastEventAt: events.reduce((max, e) => new Date(e.eventTimestamp) > max ? new Date(e.eventTimestamp) : max, new Date(events[0].eventTimestamp)),
        page: firstEvent.page,
        pageType: firstEvent.pageType,
        domain: firstEvent.domain,
        deviceType: firstEvent.deviceType,
        os: firstEvent.os,
        browser: firstEvent.browser,
        utmSource: firstEvent.utmSource,
        utmCampaign: firstEvent.utmCampaign,
        utmMedium: firstEvent.utmMedium,
        geoState: firstEvent.geoState,
        referrer: events.find(e => e.referrer)?.referrer || null,
        pageUrl: firstEvent.pageUrl,
        screenResolution: firstEvent.screenResolution,
        viewport: firstEvent.viewport,
        language: firstEvent.language,
        selectedState: events.find(e => e.selectedState)?.selectedState || null,
        ipAddress: firstEvent.ipAddress,
        firstName: (() => { const fc = events.find(e => e.eventType === "form_complete"); return fc?.firstName || null; })(),
        lastName: (() => { const fc = events.find(e => e.eventType === "form_complete"); return fc?.lastName || null; })(),
        email: (() => { const fc = events.find(e => e.eventType === "form_complete"); return fc?.email || null; })(),
        phone: (() => { const fc = events.find(e => e.eventType === "form_complete"); return fc?.phone || null; })(),
        quizAnswers: (() => {
          const lastWithAnswers = [...events].reverse().find(e => e.quizAnswers && Object.keys(e.quizAnswers as any).length > 0);
          return (lastWithAnswers?.quizAnswers as Record<string, string>) || null;
        })(),
      };
    });

    return {
      sessions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async insertRequestLog(log: InsertRequestLog): Promise<RequestLog> {
    const [result] = await db.insert(requestLogs).values(log as any).returning();
    return result;
  }

  async getRequestLogs(filters: {
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    statusCode?: number;
    eventType?: string;
    domain?: string;
    search?: string;
  }, page: number, limit: number): Promise<{ logs: RequestLog[]; total: number; page: number; limit: number; totalPages: number }> {
    const conditions = [];

    if (filters.startDate) {
      const startHour = filters.startTime || "00:00";
      const start = new Date(`${filters.startDate}T${startHour}:00.000Z`);
      conditions.push(gte(requestLogs.createdAt, start));
    }
    if (filters.endDate) {
      const endHour = filters.endTime || "24:00";
      let end: Date;
      if (endHour === "24:00") {
        end = new Date(`${filters.endDate}T23:59:59.999Z`);
      } else {
        end = new Date(`${filters.endDate}T${endHour}:00.000Z`);
      }
      conditions.push(lte(requestLogs.createdAt, end));
    }
    if (filters.statusCode) {
      conditions.push(eq(requestLogs.statusCode, filters.statusCode));
    }
    if (filters.eventType) {
      conditions.push(eq(requestLogs.eventType, filters.eventType));
    }
    if (filters.domain) {
      conditions.push(eq(requestLogs.domain, filters.domain));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(requestLogs.path, `%${filters.search}%`),
          ilike(requestLogs.ipAddress, `%${filters.search}%`),
          ilike(requestLogs.sessionId, `%${filters.search}%`),
          ilike(requestLogs.origin, `%${filters.search}%`),
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ total: count() })
      .from(requestLogs)
      .where(where);

    const total = Number(countResult?.total || 0);
    const offset = (page - 1) * limit;

    const logs = await db
      .select()
      .from(requestLogs)
      .where(where)
      .orderBy(desc(requestLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteRequestLogs(beforeDate?: string): Promise<number> {
    if (beforeDate) {
      const result = await db.delete(requestLogs).where(lte(requestLogs.createdAt, new Date(beforeDate))).returning({ id: requestLogs.id });
      return result.length;
    }
    const result = await db.delete(requestLogs).returning({ id: requestLogs.id });
    return result.length;
  }

  async getBlockedNumbers(): Promise<BlockedNumber[]> {
    return db.select().from(blockedNumbers).orderBy(desc(blockedNumbers.blockedAt));
  }

  async isPhoneBlocked(phone: string): Promise<boolean> {
    const normalized = phone.replace(/\D/g, "");
    const results = await db.select().from(blockedNumbers);
    return results.some(b => b.phone.replace(/\D/g, "") === normalized);
  }

  async blockPhone(phone: string, reason?: string): Promise<BlockedNumber> {
    const [result] = await db.insert(blockedNumbers).values({ phone, reason: reason || null }).returning();
    return result;
  }

  async unblockPhone(phone: string): Promise<void> {
    await db.delete(blockedNumbers).where(eq(blockedNumbers.phone, phone));
  }

  async bulkUnblockPhones(phones: string[]): Promise<number> {
    if (phones.length === 0) return 0;
    const result = await db.delete(blockedNumbers).where(inArray(blockedNumbers.phone, phones)).returning();
    return result.length;
  }
}

export const storage = new DatabaseStorage();
