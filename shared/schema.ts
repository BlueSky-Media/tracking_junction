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
  eventTimestamp: timestamp("event_timestamp").notNull().defaultNow(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
}, (table) => [
  index("idx_events_session").on(table.sessionId),
  index("idx_events_page_type").on(table.page, table.pageType),
  index("idx_events_domain").on(table.domain),
  index("idx_events_timestamp").on(table.eventTimestamp),
  index("idx_events_step").on(table.page, table.pageType, table.stepNumber),
]);

export const insertTrackingEventSchema = createInsertSchema(trackingEvents).omit({
  id: true,
  receivedAt: true,
});

export const trackingEventApiSchema = z.object({
  page: z.enum(["seniors", "veterans", "first-responders"]),
  page_type: z.enum(["lead", "call"]),
  domain: z.enum(["blueskylife.net", "blueskylife.io"]),
  step_number: z.number().int().min(1).max(20),
  step_name: z.string().min(1).max(100),
  selected_value: z.string().optional(),
  session_id: z.string().uuid(),
  timestamp: z.string().optional(),
  user_agent: z.string().optional(),
});

export type InsertTrackingEvent = z.infer<typeof insertTrackingEventSchema>;
export type TrackingEvent = typeof trackingEvents.$inferSelect;
export type TrackingEventApi = z.infer<typeof trackingEventApiSchema>;

export const LEAD_STEPS = [
  { number: 1, name: "State" },
  { number: 2, name: "Age" },
  { number: 3, name: "Income" },
  { number: 4, name: "Budget" },
  { number: 5, name: "Beneficiary" },
  { number: 6, name: "Name" },
  { number: 7, name: "Email" },
  { number: 8, name: "Phone" },
  { number: 9, name: "Thank You" },
];

export const CALL_STEPS = [
  { number: 1, name: "State" },
  { number: 2, name: "Age" },
  { number: 3, name: "Income" },
  { number: 4, name: "Budget" },
  { number: 5, name: "Purpose" },
  { number: 6, name: "Call CTA" },
];
