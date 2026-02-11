import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { trackingEventApiSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

const PII_FIELDS = ["first_name", "last_name", "email", "phone", "firstName", "lastName"];

function redactPii(body: any): any {
  if (!body || typeof body !== "object") return body;
  const redacted = { ...body };
  for (const field of PII_FIELDS) {
    if (redacted[field]) redacted[field] = "[REDACTED]";
  }
  return redacted;
}

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
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Max-Age", "86400");
    res.header("Vary", "Origin");
    res.status(204).end();
  });

  app.post("/api/events", async (req, res) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "POST");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Vary", "Origin");

    const startTime = Date.now();
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";

    try {
      const parsed = trackingEventApiSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("Event validation failed:", JSON.stringify(parsed.error.issues), "Body:", JSON.stringify(req.body).substring(0, 500));
        const responseBody = { ok: false, error: "Invalid event data", details: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`) };

        storage.insertRequestLog({
          method: req.method,
          path: req.path,
          statusCode: 400,
          requestBody: redactPii(req.body),
          responseBody,
          ipAddress: clientIp,
          userAgent: req.headers["user-agent"] || null,
          origin: (req.headers.origin as string) || null,
          contentType: (req.headers["content-type"] as string) || null,
          durationMs: Date.now() - startTime,
          errorMessage: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "),
          eventType: req.body?.event_type || null,
          domain: req.body?.domain || null,
          sessionId: req.body?.session_id || null,
        }).catch(e => console.error("Failed to log request:", e));

        return res.status(400).json(responseBody);
      }

      const data = parsed.data;

      const isFormComplete = data.event_type === "form_complete";

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
        os: data.os || null,
        browser: data.browser || null,
        placement: data.placement || null,
        geoState: data.geo_state || null,
        ipAddress: data.ip_address || null,
        firstName: isFormComplete ? (data.first_name || null) : null,
        lastName: isFormComplete ? (data.last_name || null) : null,
        email: isFormComplete ? (data.email || null) : null,
        phone: isFormComplete ? (data.phone || null) : null,
        eventId: data.event_id || null,
        externalId: data.external_id || null,
        utmTerm: data.utm_term || null,
        utmId: data.utm_id || null,
        mediaType: data.media_type || null,
        campaignName: data.campaign_name || null,
        campaignId: data.campaign_id || null,
        adName: data.ad_name || null,
        adId: data.ad_id || null,
        adsetName: data.adset_name || null,
        adsetId: data.adset_id || null,
        fbclid: data.fbclid || null,
        fbc: data.fbc || null,
        fbp: data.fbp || null,
        quizAnswers: data.quiz_answers || null,
      });

      const successResponse = { ok: true };

      storage.insertRequestLog({
        method: req.method,
        path: req.path,
        statusCode: 200,
        requestBody: redactPii(req.body),
        responseBody: successResponse,
        ipAddress: clientIp,
        userAgent: req.headers["user-agent"] || null,
        origin: (req.headers.origin as string) || null,
        contentType: (req.headers["content-type"] as string) || null,
        durationMs: Date.now() - startTime,
        errorMessage: null,
        eventType: data.event_type || null,
        domain: data.domain || null,
        sessionId: data.session_id || null,
      }).catch(e => console.error("Failed to log request:", e));

      res.status(200).json(successResponse);
    } catch (error) {
      console.error("Error inserting event:", error);
      const errorResponse = { ok: false, error: "Failed to process event" };

      storage.insertRequestLog({
        method: req.method,
        path: req.path,
        statusCode: 500,
        requestBody: redactPii(req.body),
        responseBody: errorResponse,
        ipAddress: clientIp,
        userAgent: req.headers["user-agent"] || null,
        origin: (req.headers.origin as string) || null,
        contentType: (req.headers["content-type"] as string) || null,
        durationMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error),
        eventType: req.body?.event_type || null,
        domain: req.body?.domain || null,
        sessionId: req.body?.session_id || null,
      }).catch(e => console.error("Failed to log request:", e));

      res.status(500).json(errorResponse);
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

  app.delete("/api/analytics/all-events", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteAllEvents();
      res.json({ message: "All events deleted" });
    } catch (error) {
      console.error("Error deleting events:", error);
      res.status(500).json({ message: "Failed to delete events" });
    }
  });

  app.delete("/api/analytics/events/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      await storage.deleteEvent(id);
      res.json({ message: "Event deleted" });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  app.delete("/api/analytics/events/session/:sessionId", isAuthenticated, async (req, res) => {
    try {
      const count = await storage.deleteEventsBySession(req.params.sessionId as string);
      res.json({ message: `Deleted ${count} events for session`, count });
    } catch (error) {
      console.error("Error deleting session events:", error);
      res.status(500).json({ message: "Failed to delete session events" });
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

  app.get("/api/server-logs", isAuthenticated, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        startTime: req.query.startTime as string | undefined,
        endTime: req.query.endTime as string | undefined,
        statusCode: req.query.statusCode ? parseInt(req.query.statusCode as string) : undefined,
        eventType: req.query.eventType as string | undefined,
        domain: req.query.domain as string | undefined,
        search: req.query.search as string | undefined,
      };
      const logs = await storage.getRequestLogs(filters, page, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching server logs:", error);
      res.status(500).json({ message: "Failed to fetch server logs" });
    }
  });

  app.delete("/api/server-logs", isAuthenticated, async (req, res) => {
    try {
      const beforeDate = req.query.beforeDate as string | undefined;
      const count = await storage.deleteRequestLogs(beforeDate);
      res.json({ message: `Deleted ${count} log entries`, count });
    } catch (error) {
      console.error("Error deleting server logs:", error);
      res.status(500).json({ message: "Failed to delete server logs" });
    }
  });

  return httpServer;
}
