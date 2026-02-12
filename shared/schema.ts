export * from "./models/auth";

import { pgTable, text, varchar, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const trackingEvents = pgTable("tracking_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  page: varchar("page", { length: 50 }).notNull(),
  pageType: varchar("page_type", { length: 20 }).notNull(),
  domain: varchar("domain", { length: 100 }).notNull(),
  stepNumber: integer("step_number").notNull(),
  stepName: varchar("step_name", { length: 100 }).notNull(),
  selectedValue: text("selected_value"),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  userAgent: text("user_agent"),
  eventType: varchar("event_type", { length: 30 }).default("step_complete"),
  utmSource: varchar("utm_source", { length: 200 }),
  utmCampaign: varchar("utm_campaign", { length: 200 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmContent: varchar("utm_content", { length: 200 }),
  deviceType: varchar("device_type", { length: 20 }),
  referrer: text("referrer"),
  timeOnStep: integer("time_on_step"),
  eventTimestamp: timestamp("event_timestamp").notNull().defaultNow(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  os: varchar("os", { length: 50 }),
  browser: varchar("browser", { length: 50 }),
  placement: varchar("placement", { length: 200 }),
  geoState: varchar("geo_state", { length: 10 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  eventId: varchar("event_id", { length: 100 }),
  externalId: varchar("external_id", { length: 200 }),
  utmTerm: varchar("utm_term", { length: 200 }),
  utmId: varchar("utm_id", { length: 200 }),
  mediaType: varchar("media_type", { length: 50 }),
  campaignName: varchar("campaign_name", { length: 200 }),
  campaignId: varchar("campaign_id", { length: 200 }),
  adName: varchar("ad_name", { length: 200 }),
  adId: varchar("ad_id", { length: 200 }),
  adsetName: varchar("adset_name", { length: 200 }),
  adsetId: varchar("adset_id", { length: 200 }),
  fbclid: text("fbclid"),
  fbc: text("fbc"),
  fbp: text("fbp"),
  quizAnswers: jsonb("quiz_answers"),
  pageUrl: text("page_url"),
  screenResolution: varchar("screen_resolution", { length: 30 }),
  viewport: varchar("viewport", { length: 30 }),
  language: varchar("language", { length: 20 }),
  selectedState: varchar("selected_state", { length: 10 }),
  country: varchar("country", { length: 10 }),
  browserVersion: varchar("browser_version", { length: 100 }),
  osVersion: varchar("os_version", { length: 100 }),
  ipType: varchar("ip_type", { length: 10 }),
}, (table) => [
  index("idx_events_session").on(table.sessionId),
  index("idx_events_page_type").on(table.page, table.pageType),
  index("idx_events_domain").on(table.domain),
  index("idx_events_timestamp").on(table.eventTimestamp),
  index("idx_events_step").on(table.page, table.pageType, table.stepNumber),
  index("idx_events_event_type").on(table.eventType),
  index("idx_events_utm_campaign").on(table.utmCampaign),
  index("idx_events_device_type").on(table.deviceType),
]);

export const requestLogs = pgTable("request_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  method: varchar("method", { length: 10 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  statusCode: integer("status_code").notNull(),
  requestBody: jsonb("request_body"),
  responseBody: jsonb("response_body"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  origin: varchar("origin", { length: 500 }),
  contentType: varchar("content_type", { length: 200 }),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  eventType: varchar("event_type", { length: 50 }),
  domain: varchar("domain", { length: 100 }),
  sessionId: varchar("session_id", { length: 64 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_request_logs_created").on(table.createdAt),
  index("idx_request_logs_status").on(table.statusCode),
  index("idx_request_logs_event_type").on(table.eventType),
  index("idx_request_logs_domain").on(table.domain),
]);

export const insertRequestLogSchema = createInsertSchema(requestLogs).omit({
  id: true as const,
  createdAt: true as const,
});

export type InsertRequestLog = z.infer<typeof insertRequestLogSchema>;
export type RequestLog = typeof requestLogs.$inferSelect;

export const insertTrackingEventSchema = createInsertSchema(trackingEvents).omit({
  id: true as const,
  receivedAt: true as const,
});

export const trackingEventApiSchema = z.object({
  page: z.string().min(1).max(50),
  page_type: z.string().min(1).max(20),
  domain: z.string().min(1).max(100),
  step_number: z.preprocess((v) => (typeof v === "string" ? parseInt(v, 10) : v), z.number().int().min(0).max(20)),
  step_name: z.string().min(1).max(100),
  selected_value: z.string().optional(),
  session_id: z.string().min(1).max(64),
  timestamp: z.string().optional(),
  user_agent: z.string().optional(),
  event_type: z.string().max(30).optional(),
  utm_source: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_content: z.string().max(200).optional(),
  device_type: z.string().max(20).optional(),
  referrer: z.string().optional(),
  time_on_step: z.preprocess((v) => (typeof v === "string" ? parseInt(v, 10) : v), z.number().int().min(0).max(3600).optional()),
  os: z.string().max(50).optional(),
  browser: z.string().max(50).optional(),
  placement: z.string().max(200).optional(),
  geo_state: z.string().max(10).optional(),
  ip_address: z.string().max(45).optional(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  event_id: z.string().max(100).optional(),
  external_id: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
  utm_id: z.string().max(200).optional(),
  media_type: z.string().max(50).optional(),
  campaign_name: z.string().max(200).optional(),
  campaign_id: z.string().max(200).optional(),
  ad_name: z.string().max(200).optional(),
  ad_id: z.string().max(200).optional(),
  adset_name: z.string().max(200).optional(),
  adset_id: z.string().max(200).optional(),
  fbclid: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  quiz_answers: z.record(z.string(), z.any()).optional(),
  page_url: z.string().optional(),
  screen_resolution: z.string().max(30).optional(),
  viewport: z.string().max(30).optional(),
  language: z.string().max(20).optional(),
  selected_state: z.string().max(10).optional(),
  country: z.string().max(10).optional(),
  browser_version: z.string().max(100).optional(),
  os_version: z.string().max(100).optional(),
  ip_type: z.string().max(10).optional(),
}).passthrough();

export type InsertTrackingEvent = z.infer<typeof insertTrackingEventSchema>;
export type TrackingEvent = typeof trackingEvents.$inferSelect;
export type TrackingEventApi = z.infer<typeof trackingEventApiSchema>;

export const blockedNumbers = pgTable("blocked_numbers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  phone: varchar("phone", { length: 50 }).notNull().unique(),
  reason: text("reason"),
  blockedAt: timestamp("blocked_at").notNull().defaultNow(),
}, (table) => [
  index("idx_blocked_phone").on(table.phone),
]);

export const insertBlockedNumberSchema = createInsertSchema(blockedNumbers).omit({
  id: true as const,
  blockedAt: true as const,
});

export type InsertBlockedNumber = z.infer<typeof insertBlockedNumberSchema>;
export type BlockedNumber = typeof blockedNumbers.$inferSelect;

export const LEAD_STEPS_SENIORS = [
  { number: 0, name: "Landing" },
  { number: 1, name: "Beneficiary" },
  { number: 2, name: "State" },
  { number: 3, name: "Budget Affordability" },
  { number: 4, name: "Age" },
  { number: 5, name: "Monthly Income" },
  { number: 6, name: "Eligibility Check" },
  { number: 7, name: "Contact First Name" },
  { number: 8, name: "Contact Last Name" },
  { number: 9, name: "Contact Email" },
  { number: 10, name: "Contact Phone" },
];

export const LEAD_STEPS_VETERANS = [
  { number: 0, name: "Landing" },
  { number: 1, name: "Military Branch" },
  { number: 2, name: "State" },
  { number: 3, name: "Beneficiary" },
  { number: 4, name: "Budget Affordability" },
  { number: 5, name: "Age" },
  { number: 6, name: "Monthly Income" },
  { number: 7, name: "Eligibility Check" },
  { number: 8, name: "Contact First Name" },
  { number: 9, name: "Contact Last Name" },
  { number: 10, name: "Contact Email" },
  { number: 11, name: "Contact Phone" },
];

export const LEAD_STEPS_FIRST_RESPONDERS = [
  { number: 0, name: "Landing" },
  { number: 1, name: "First Responder Agency" },
  { number: 2, name: "State" },
  { number: 3, name: "Beneficiary" },
  { number: 4, name: "Budget Affordability" },
  { number: 5, name: "Age" },
  { number: 6, name: "Monthly Income" },
  { number: 7, name: "Eligibility Check" },
  { number: 8, name: "Contact First Name" },
  { number: 9, name: "Contact Last Name" },
  { number: 10, name: "Contact Email" },
  { number: 11, name: "Contact Phone" },
];

export const LEAD_STEPS = LEAD_STEPS_SENIORS;

export const CALL_STEPS = [
  { number: 0, name: "Landing" },
  { number: 1, name: "State" },
  { number: 2, name: "Age" },
  { number: 3, name: "Monthly Income" },
  { number: 4, name: "Budget" },
  { number: 5, name: "Purpose" },
  { number: 6, name: "Call CTA" },
];

export function getLeadStepsForAudience(audience: string) {
  switch (audience) {
    case "veterans": return LEAD_STEPS_VETERANS;
    case "first-responders": return LEAD_STEPS_FIRST_RESPONDERS;
    default: return LEAD_STEPS_SENIORS;
  }
}
