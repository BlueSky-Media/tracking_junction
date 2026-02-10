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

function parseFilters(query: any) {
  return {
    page: query.page as string | undefined,
    pageType: query.pageType as string | undefined,
    domain: query.domain as string | undefined,
    startDate: query.startDate as string | undefined,
    endDate: query.endDate as string | undefined,
    utmSource: query.utmSource as string | undefined,
    utmCampaign: query.utmCampaign as string | undefined,
    utmMedium: query.utmMedium as string | undefined,
    utmContent: query.utmContent as string | undefined,
    deviceType: query.deviceType as string | undefined,
  };
}

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
        eventType: data.event_type || "step_complete",
        utmSource: data.utm_source || null,
        utmCampaign: data.utm_campaign || null,
        utmMedium: data.utm_medium || null,
        utmContent: data.utm_content || null,
        deviceType: data.device_type || null,
        referrer: data.referrer || null,
        timeOnStep: data.time_on_step ?? null,
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
      const filters = parseFilters(req.query);
      const stats = await storage.getStats(filters);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/analytics/funnel", isAuthenticated, async (req, res) => {
    try {
      const filters = parseFilters(req.query);
      const funnel = await storage.getFunnel(filters);
      res.json(funnel);
    } catch (error) {
      console.error("Error fetching funnel:", error);
      res.status(500).json({ message: "Failed to fetch funnel" });
    }
  });

  app.get("/api/analytics/breakdown", isAuthenticated, async (req, res) => {
    try {
      const filters = parseFilters(req.query);
      const breakdown = await storage.getBreakdown(filters);
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching breakdown:", error);
      res.status(500).json({ message: "Failed to fetch breakdown" });
    }
  });

  app.get("/api/analytics/bounce", isAuthenticated, async (req, res) => {
    try {
      const filters = parseFilters(req.query);
      const bounce = await storage.getBounceRate(filters);
      res.json(bounce);
    } catch (error) {
      console.error("Error fetching bounce rate:", error);
      res.status(500).json({ message: "Failed to fetch bounce rate" });
    }
  });

  app.get("/api/analytics/campaigns", isAuthenticated, async (req, res) => {
    try {
      const filters = parseFilters(req.query);
      const campaigns = await storage.getCampaignComparison(filters);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaign data:", error);
      res.status(500).json({ message: "Failed to fetch campaign data" });
    }
  });

  app.get("/api/analytics/devices", isAuthenticated, async (req, res) => {
    try {
      const filters = parseFilters(req.query);
      const devices = await storage.getDeviceBreakdown(filters);
      res.json(devices);
    } catch (error) {
      console.error("Error fetching device data:", error);
      res.status(500).json({ message: "Failed to fetch device data" });
    }
  });

  app.get("/api/analytics/heatmap", isAuthenticated, async (req, res) => {
    try {
      const filters = parseFilters(req.query);
      const heatmap = await storage.getTimeHeatmap(filters);
      res.json(heatmap);
    } catch (error) {
      console.error("Error fetching heatmap data:", error);
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });

  app.get("/api/analytics/contact-funnel", isAuthenticated, async (req, res) => {
    try {
      const filters = parseFilters(req.query);
      const contactFunnel = await storage.getContactFormFunnel(filters);
      res.json(contactFunnel);
    } catch (error) {
      console.error("Error fetching contact funnel:", error);
      res.status(500).json({ message: "Failed to fetch contact funnel" });
    }
  });

  app.get("/api/analytics/referrers", isAuthenticated, async (req, res) => {
    try {
      const filters = parseFilters(req.query);
      const referrers = await storage.getReferrerBreakdown(filters);
      res.json(referrers);
    } catch (error) {
      console.error("Error fetching referrer data:", error);
      res.status(500).json({ message: "Failed to fetch referrer data" });
    }
  });

  app.get("/api/analytics/filter-options", isAuthenticated, async (req, res) => {
    try {
      const options = await storage.getFilterOptions();
      res.json(options);
    } catch (error) {
      console.error("Error fetching filter options:", error);
      res.status(500).json({ message: "Failed to fetch filter options" });
    }
  });

  app.get("/api/analytics/drilldown", isAuthenticated, async (req, res) => {
    try {
      const filters = parseFilters(req.query);
      const groupBy = (req.query.groupBy as string) || "domain";
      const validGroups = ["domain", "deviceType", "utmSource", "utmCampaign", "utmMedium", "page"];
      if (!validGroups.includes(groupBy)) {
        return res.status(400).json({ message: "Invalid groupBy parameter" });
      }
      const drilldown = await storage.getDrilldown(filters, groupBy);
      res.json(drilldown);
    } catch (error) {
      console.error("Error fetching drilldown:", error);
      res.status(500).json({ message: "Failed to fetch drilldown data" });
    }
  });

  app.get("/api/analytics/logs", isAuthenticated, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const search = req.query.search as string | undefined;
      const filters = parseFilters(req.query);
      filters.page = req.query.audience as string | undefined;
      const logs = await storage.getEventLogs(filters, page, limit, search);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching event logs:", error);
      res.status(500).json({ message: "Failed to fetch event logs" });
    }
  });

  app.get("/api/analytics/export", isAuthenticated, async (req, res) => {
    try {
      const filters = parseFilters(req.query);
      const csv = await storage.exportCsv(filters);
      res.header("Content-Type", "text/csv");
      res.header("Content-Disposition", `attachment; filename="tracking-export-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  return httpServer;
}
