import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { trackingEventApiSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

const ALLOWED_ORIGINS = [
  "https://blueskylife.net",
  "https://www.blueskylife.net",
  "https://blueskylife.io",
  "https://www.blueskylife.io",
];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.options("/api/events", (req, res) => {
    const origin = req.headers.origin;
    res.header("Vary", "Origin");
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Max-Age", "86400");
      res.status(204).end();
    } else {
      res.status(403).end();
    }
  });

  app.post("/api/events", async (req, res) => {
    const origin = req.headers.origin;
    res.header("Vary", "Origin");
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "POST");
      res.header("Access-Control-Allow-Headers", "Content-Type");
    }

    try {
      const parsed = trackingEventApiSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: "Invalid event data" });
      }

      const data = parsed.data;

      const event = await storage.insertEvent({
        page: data.page,
        pageType: data.page_type,
        domain: data.domain,
        stepNumber: data.step_number,
        stepName: data.step_name,
        selectedValue: data.selected_value || null,
        sessionId: data.session_id,
        userAgent: data.user_agent || req.headers["user-agent"] || null,
        eventTimestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      });

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Error inserting event:", error);
      res.status(500).json({ ok: false, error: "Failed to process event" });
    }
  });

  app.get("/api/analytics/stats", isAuthenticated, async (req, res) => {
    try {
      const filters = {
        page: req.query.page as string | undefined,
        pageType: req.query.pageType as string | undefined,
        domain: req.query.domain as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const stats = await storage.getStats(filters);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/analytics/funnel", isAuthenticated, async (req, res) => {
    try {
      const filters = {
        page: req.query.page as string | undefined,
        pageType: req.query.pageType as string | undefined,
        domain: req.query.domain as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const funnel = await storage.getFunnel(filters);
      res.json(funnel);
    } catch (error) {
      console.error("Error fetching funnel:", error);
      res.status(500).json({ message: "Failed to fetch funnel" });
    }
  });

  app.get("/api/analytics/breakdown", isAuthenticated, async (req, res) => {
    try {
      const filters = {
        page: req.query.page as string | undefined,
        pageType: req.query.pageType as string | undefined,
        domain: req.query.domain as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const breakdown = await storage.getBreakdown(filters);
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching breakdown:", error);
      res.status(500).json({ message: "Failed to fetch breakdown" });
    }
  });

  return httpServer;
}
