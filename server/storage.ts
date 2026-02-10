import {
  trackingEvents,
  type InsertTrackingEvent,
  type TrackingEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, count, countDistinct, desc } from "drizzle-orm";

interface AnalyticsFilters {
  page?: string;
  pageType?: string;
  domain?: string;
  startDate?: string;
  endDate?: string;
}

interface FunnelStep {
  stepNumber: number;
  stepName: string;
  uniqueVisitors: number;
  conversionRate: number;
  dropOffRate: number;
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
}

export interface IStorage {
  insertEvent(event: InsertTrackingEvent): Promise<TrackingEvent>;
  insertEventsBatch(events: InsertTrackingEvent[]): Promise<void>;
  getStats(filters: AnalyticsFilters): Promise<StatsData>;
  getFunnel(filters: AnalyticsFilters): Promise<{ steps: FunnelStep[] }>;
  getBreakdown(filters: AnalyticsFilters): Promise<StepBreakdownData[]>;
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
  return conditions.length > 0 ? and(...conditions) : undefined;
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
      return { totalSessions: 0, totalEvents: 0, overallConversion: 0, avgStepsCompleted: 0 };
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
      .where(where)
      .groupBy(trackingEvents.sessionId);

    const avgStepsCompleted =
      avgResult.length > 0
        ? avgResult.reduce((sum, r) => sum + (r.maxStep || 0), 0) / avgResult.length
        : 0;

    return { totalSessions, totalEvents, overallConversion, avgStepsCompleted };
  }

  async getFunnel(filters: AnalyticsFilters): Promise<{ steps: FunnelStep[] }> {
    const where = buildConditions(filters);

    const stepsData = await db
      .select({
        stepNumber: trackingEvents.stepNumber,
        stepName: trackingEvents.stepName,
        uniqueVisitors: countDistinct(trackingEvents.sessionId),
      })
      .from(trackingEvents)
      .where(where)
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
      .where(and(where, sql`${trackingEvents.selectedValue} IS NOT NULL AND ${trackingEvents.selectedValue} != ''`))
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
}

export const storage = new DatabaseStorage();
