import { db } from "./db";
import { trackingEvents } from "@shared/schema";
import { count } from "drizzle-orm";
import { randomUUID } from "crypto";

const STATES = ["California", "Texas", "Florida", "New York", "Arizona", "Ohio", "Pennsylvania", "Illinois"];
const AGES = ["55-60", "61-65", "66-70", "71-75", "76-80", "80+"];
const INCOMES = ["No Income", "Under $25k", "$25k-$50k", "$50k-$75k", "$75k-$100k", "Over $100k"];
const BUDGETS = ["Under $50/mo", "$50-$100/mo", "$100-$200/mo", "$200-$300/mo", "Over $300/mo"];
const BENEFICIARIES = ["Just Me", "Me & Spouse", "Family", "Other"];
const PURPOSES = ["Final Expense", "Mortgage Protection", "Income Replacement", "Legacy Planning"];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLeadSession(page: string, domain: string, baseTime: Date) {
  const sessionId = randomUUID();
  const events: any[] = [];
  const stepsCompleted = weightedStepCount(9);

  const steps = [
    { number: 1, name: "State", values: STATES },
    { number: 2, name: "Age", values: AGES },
    { number: 3, name: "Income", values: INCOMES },
    { number: 4, name: "Budget", values: BUDGETS },
    { number: 5, name: "Beneficiary", values: BENEFICIARIES },
    { number: 6, name: "Name", values: null },
    { number: 7, name: "Email", values: null },
    { number: 8, name: "Phone", values: null },
    { number: 9, name: "Thank You", values: null },
  ];

  for (let i = 0; i < stepsCompleted; i++) {
    const step = steps[i];
    const ts = new Date(baseTime.getTime() + i * (5000 + Math.random() * 30000));
    events.push({
      page,
      pageType: "lead",
      domain,
      stepNumber: step.number,
      stepName: step.name,
      selectedValue: step.values ? pickRandom(step.values) : null,
      sessionId,
      userAgent: "Mozilla/5.0 (Seed Data)",
      eventTimestamp: ts,
    });
  }

  return events;
}

function generateCallSession(page: string, domain: string, baseTime: Date) {
  const sessionId = randomUUID();
  const events: any[] = [];
  const stepsCompleted = weightedStepCount(6);

  const steps = [
    { number: 1, name: "State", values: STATES },
    { number: 2, name: "Age", values: AGES },
    { number: 3, name: "Income", values: INCOMES },
    { number: 4, name: "Budget", values: BUDGETS },
    { number: 5, name: "Purpose", values: PURPOSES },
    { number: 6, name: "Call CTA", values: null },
  ];

  for (let i = 0; i < stepsCompleted; i++) {
    const step = steps[i];
    const ts = new Date(baseTime.getTime() + i * (5000 + Math.random() * 25000));
    events.push({
      page,
      pageType: "call",
      domain,
      stepNumber: step.number,
      stepName: step.name,
      selectedValue: step.values ? pickRandom(step.values) : null,
      sessionId,
      userAgent: "Mozilla/5.0 (Seed Data)",
      eventTimestamp: ts,
    });
  }

  return events;
}

function weightedStepCount(maxSteps: number): number {
  const r = Math.random();
  if (r < 0.05) return 1;
  if (r < 0.12) return 2;
  if (r < 0.22) return 3;
  if (r < 0.35) return Math.min(4, maxSteps);
  if (r < 0.50) return Math.min(5, maxSteps);
  if (r < 0.65) return Math.min(6, maxSteps);
  if (r < 0.78) return Math.min(7, maxSteps);
  if (r < 0.88) return Math.min(8, maxSteps);
  return maxSteps;
}

export async function seedDatabase() {
  const [existing] = await db.select({ total: count() }).from(trackingEvents);
  if (existing.total > 0) {
    console.log(`Database already has ${existing.total} events, skipping seed.`);
    return;
  }

  console.log("Seeding database with sample tracking events...");

  const pages = ["seniors", "veterans", "first-responders"];
  const domains = ["blueskylife.net", "blueskylife.io"];
  const allEvents: any[] = [];

  const now = new Date();

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const baseDay = new Date(now.getTime() - dayOffset * 86400000);

    for (const page of pages) {
      for (const domain of domains) {
        const leadSessionCount = 8 + Math.floor(Math.random() * 12);
        for (let s = 0; s < leadSessionCount; s++) {
          const sessionTime = new Date(
            baseDay.getTime() + Math.random() * 86400000
          );
          allEvents.push(...generateLeadSession(page, domain, sessionTime));
        }

        const callSessionCount = 3 + Math.floor(Math.random() * 6);
        for (let s = 0; s < callSessionCount; s++) {
          const sessionTime = new Date(
            baseDay.getTime() + Math.random() * 86400000
          );
          allEvents.push(...generateCallSession(page, domain, sessionTime));
        }
      }
    }
  }

  const batchSize = 500;
  for (let i = 0; i < allEvents.length; i += batchSize) {
    const batch = allEvents.slice(i, i + batchSize);
    await db.insert(trackingEvents).values(batch);
  }

  console.log(`Seeded ${allEvents.length} tracking events.`);
}
