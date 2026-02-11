export * from "./models/auth";

import { pgTable, text, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
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
  phone: varchar("phone", { length: 20 }),
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

export const insertTrackingEventSchema = createInsertSchema(trackingEvents).omit({
  id: true as const,
  receivedAt: true as const,
});

export const trackingEventApiSchema = z.object({
  page: z.enum(["seniors", "veterans", "first-responders"]),
  page_type: z.enum(["lead", "call"]),
  domain: z.enum(["blueskylife.net", "blueskylife.io"]),
  step_number: z.number().int().min(0).max(20),
  step_name: z.string().min(1).max(100),
  selected_value: z.string().optional(),
  session_id: z.string().uuid(),
  timestamp: z.string().optional(),
  user_agent: z.string().optional(),
  event_type: z.enum(["page_land", "step_complete", "form_complete"]).optional(),
  utm_source: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_content: z.string().max(200).optional(),
  device_type: z.enum(["mobile", "desktop", "tablet"]).optional(),
  referrer: z.string().optional(),
  time_on_step: z.number().int().min(0).max(3600).optional(),
  os: z.string().max(50).optional(),
  browser: z.string().max(50).optional(),
  placement: z.string().max(200).optional(),
  geo_state: z.string().max(10).optional(),
  ip_address: z.string().max(45).optional(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
});

export type InsertTrackingEvent = z.infer<typeof insertTrackingEventSchema>;
export type TrackingEvent = typeof trackingEvents.$inferSelect;
export type TrackingEventApi = z.infer<typeof trackingEventApiSchema>;

export const LEAD_STEPS = [
  { number: 0, name: "Landing" },
  { number: 1, name: "Beneficiary" },
  { number: 2, name: "State" },
  { number: 3, name: "Budget" },
  { number: 4, name: "Age" },
  { number: 5, name: "Income" },
  { number: 6, name: "Name" },
  { number: 7, name: "Email" },
  { number: 8, name: "Phone" },
];

export const CALL_STEPS = [
  { number: 0, name: "Landing" },
  { number: 1, name: "State" },
  { number: 2, name: "Age" },
  { number: 3, name: "Income" },
  { number: 4, name: "Budget" },
  { number: 5, name: "Purpose" },
  { number: 6, name: "Call CTA" },
];
