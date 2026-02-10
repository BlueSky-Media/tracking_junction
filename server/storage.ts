import {
  trackingEvents,
  type InsertTrackingEvent,
  type TrackingEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, count, countDistinct, desc, avg, isNotNull, ne } from "drizzle-orm";

export interface AnalyticsFilters {
  page?: string;
  pageType?: string;
  domain?: string;
  startDate?: string;
  endDate?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  utmContent?: string;
  deviceType?: string;
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
  completions: number;
  conversionFromPrev: number;
  conversionFromInitial: number;
}

interface DrilldownRow {
  groupValue: string;
  uniqueViews: number;
  grossViews: number;
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
  getFilterOptions(): Promise<{ utmSources: string[]; utmCampaigns: string[]; utmMediums: string[] }>;
  exportCsv(filters: AnalyticsFilters): Promise<string>;
  getDrilldown(filters: AnalyticsFilters, groupBy: string): Promise<DrilldownResult>;
  getEventLogs(filters: AnalyticsFilters, page: number, limit: number, search?: string): Promise<EventLogResult>;
}

function buildConditions(filters: AnalyticsFilters) {
  const conditions = [];
  if (filters.page) conditions.push(eq(trackingEvents.page, filters.page));
  if (filters.pageType) conditions.push(eq(trackingEvents.pageType, filters.pageType));
  if (filters.domain) conditions.push(eq(trackingEvents.domain, filters.domain));
  if (filters.startDate) conditions.push(gte(trackingEvents.eventTimestamp, new Date(filters.startDate)));
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(trackingEvents.eventTimestamp, end));
  }
  if (filters.utmSource) conditions.push(eq(trackingEvents.utmSource, filters.utmSource));
  if (filters.utmCampaign) conditions.push(eq(trackingEvents.utmCampaign, filters.utmCampaign));
  if (filters.utmMedium) conditions.push(eq(trackingEvents.utmMedium, filters.utmMedium));
  if (filters.utmContent) conditions.push(eq(trackingEvents.utmContent, filters.utmContent));
  if (filters.deviceType) conditions.push(eq(trackingEvents.deviceType, filters.deviceType));
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
          (${trackingEvents.pageType} = 'lead' AND ${trackingEvents.stepNumber} = 9)
          OR
          (${trackingEvents.pageType} = 'call' AND ${trackingEvents.stepNumber} = 6)
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
          WHEN (${trackingEvents.pageType} = 'lead' AND ${trackingEvents.stepNumber} = 9)
            OR (${trackingEvents.pageType} = 'call' AND ${trackingEvents.stepNumber} = 6)
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
          WHEN (${trackingEvents.pageType} = 'lead' AND ${trackingEvents.stepNumber} = 9)
            OR (${trackingEvents.pageType} = 'call' AND ${trackingEvents.stepNumber} = 6)
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
          WHEN (${trackingEvents.pageType} = 'lead' AND ${trackingEvents.stepNumber} = 9)
            OR (${trackingEvents.pageType} = 'call' AND ${trackingEvents.stepNumber} = 6)
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
          WHEN (${trackingEvents.pageType} = 'lead' AND ${trackingEvents.stepNumber} = 9)
            OR (${trackingEvents.pageType} = 'call' AND ${trackingEvents.stepNumber} = 6)
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

  async getFilterOptions(): Promise<{ utmSources: string[]; utmCampaigns: string[]; utmMediums: string[] }> {
    const [sources, campaigns, mediums] = await Promise.all([
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
    ]);

    return {
      utmSources: sources.map(s => s.val!).filter(Boolean),
      utmCampaigns: campaigns.map(s => s.val!).filter(Boolean),
      utmMediums: mediums.map(s => s.val!).filter(Boolean),
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
      "id", "session_id", "event_type", "page", "page_type", "domain",
      "step_number", "step_name", "selected_value", "time_on_step",
      "utm_source", "utm_campaign", "utm_medium", "utm_content",
      "device_type", "referrer", "event_timestamp"
    ];

    const csvRows = [headers.join(",")];

    for (const row of rows) {
      const values = [
        row.id,
        row.sessionId,
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
        row.deviceType || "",
        `"${(row.referrer || '').replace(/"/g, '""')}"`,
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
      step_completions AS (
        SELECT
          group_value,
          step_number,
          MIN(step_name) as step_name,
          COUNT(DISTINCT session_id) as completions
        FROM grouped_steps
        WHERE event_type = 'step_complete' OR event_type IS NULL
        GROUP BY group_value, step_number
      )
      SELECT
        gv.group_value,
        gv.unique_views,
        gv.gross_views,
        sc.step_number,
        sc.step_name,
        sc.completions
      FROM group_views gv
      LEFT JOIN step_completions sc ON gv.group_value = sc.group_value
      ORDER BY gv.unique_views DESC, gv.group_value, sc.step_number
    `);

    const results = (rows as any).rows || [];

    const groupMap = new Map<string, { uniqueViews: number; grossViews: number; stepsMap: Map<number, { stepName: string; completions: number }> }>();

    for (const r of results) {
      const gv = r.group_value as string;
      if (!groupMap.has(gv)) {
        groupMap.set(gv, {
          uniqueViews: Number(r.unique_views),
          grossViews: Number(r.gross_views),
          stepsMap: new Map(),
        });
      }
      if (r.step_number !== null && r.step_number !== undefined) {
        groupMap.get(gv)!.stepsMap.set(Number(r.step_number), {
          stepName: r.step_name as string,
          completions: Number(r.completions),
        });
      }
    }

    const allStepNumbers = new Set<number>();
    Array.from(groupMap.values()).forEach(g => {
      Array.from(g.stepsMap.keys()).forEach(sn => allStepNumbers.add(sn));
    });
    const sortedSteps = Array.from(allStepNumbers).sort((a, b) => a - b);

    function buildSteps(uniqueViews: number, stepsMap: Map<number, { stepName: string; completions: number }>): DrilldownStepData[] {
      let prevCount = uniqueViews;
      return sortedSteps.map((sn) => {
        const stepData = stepsMap.get(sn);
        const completions = stepData?.completions || 0;
        const convFromPrev = prevCount > 0 ? (completions / prevCount) * 100 : 0;
        const convFromInitial = uniqueViews > 0 ? (completions / uniqueViews) * 100 : 0;
        prevCount = completions;
        return {
          stepNumber: sn,
          stepName: stepData?.stepName || `Step ${sn}`,
          completions,
          conversionFromPrev: Math.round(convFromPrev * 10) / 10,
          conversionFromInitial: Math.round(convFromInitial * 10) / 10,
        };
      });
    }

    const drilldownRows: DrilldownRow[] = [];
    Array.from(groupMap.entries()).forEach(([gv, data]) => {
      drilldownRows.push({
        groupValue: gv,
        uniqueViews: data.uniqueViews,
        grossViews: data.grossViews,
        steps: buildSteps(data.uniqueViews, data.stepsMap),
      });
    });

    drilldownRows.sort((a, b) => b.uniqueViews - a.uniqueViews);

    const totalUniqueViews = drilldownRows.reduce((s, r) => s + r.uniqueViews, 0);
    const totalGrossViews = drilldownRows.reduce((s, r) => s + r.grossViews, 0);
    const totalsStepsMap = new Map<number, { stepName: string; completions: number }>();
    for (const row of drilldownRows) {
      for (const step of row.steps) {
        const existing = totalsStepsMap.get(step.stepNumber);
        if (existing) {
          existing.completions += step.completions;
        } else {
          totalsStepsMap.set(step.stepNumber, { stepName: step.stepName, completions: step.completions });
        }
      }
    }

    const totals: DrilldownRow = {
      groupValue: "Totals",
      uniqueViews: totalUniqueViews,
      grossViews: totalGrossViews,
      steps: buildSteps(totalUniqueViews, totalsStepsMap),
    };

    return { rows: drilldownRows, totals, groupBy };
  }

  async getEventLogs(filters: AnalyticsFilters, page: number, limit: number, search?: string): Promise<EventLogResult> {
    const conditions = [];
    if (filters.page) conditions.push(eq(trackingEvents.page, filters.page));
    if (filters.pageType) conditions.push(eq(trackingEvents.pageType, filters.pageType));
    if (filters.domain) conditions.push(eq(trackingEvents.domain, filters.domain));
    if (filters.startDate) conditions.push(gte(trackingEvents.eventTimestamp, new Date(filters.startDate)));
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(trackingEvents.eventTimestamp, end));
    }
    if (filters.utmSource) conditions.push(eq(trackingEvents.utmSource, filters.utmSource));
    if (filters.utmCampaign) conditions.push(eq(trackingEvents.utmCampaign, filters.utmCampaign));
    if (filters.utmMedium) conditions.push(eq(trackingEvents.utmMedium, filters.utmMedium));
    if (filters.deviceType) conditions.push(eq(trackingEvents.deviceType, filters.deviceType));

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
}

export const storage = new DatabaseStorage();
