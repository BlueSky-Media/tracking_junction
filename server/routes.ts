import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { trackingEventApiSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import * as facebook from "./facebook";
import { buildConversionEvent, sendConversionEvents, MetaConversionError, fireAudienceSignal } from "./meta-conversions";
import { calculateAnnualPremiumEstimate, getCapiEventName, classifyCustomerTier, evaluateRuleConditions, computeRuleValue, type EventContext, type SignalRuleConditions } from "./lead-scoring";

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

function parseMulti(val: string | undefined): string | string[] | undefined {
  if (!val) return undefined;
  const parts = val.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return parts;
}

function parseFilters(query: any) {
  return {
    page: parseMulti(query.audience as string | undefined),
    pageType: parseMulti(query.pageType as string | undefined),
    domain: parseMulti(query.domain as string | undefined),
    startDate: query.startDate as string | undefined,
    endDate: query.endDate as string | undefined,
    utmSource: parseMulti(query.utmSource as string | undefined),
    utmCampaign: parseMulti(query.utmCampaign as string | undefined),
    utmMedium: parseMulti(query.utmMedium as string | undefined),
    utmContent: parseMulti(query.utmContent as string | undefined),
    deviceType: parseMulti(query.deviceType as string | undefined),
    os: parseMulti(query.os as string | undefined),
    browser: parseMulti(query.browser as string | undefined),
    geoState: parseMulti(query.geoState as string | undefined),
    selectedState: parseMulti(query.selectedState as string | undefined),
    startTime: query.startTime as string | undefined,
    endTime: query.endTime as string | undefined,
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
        referrer: data.referrer || (req.headers.referer as string) || null,
        timeOnStep: data.time_on_step ?? null,
        eventTimestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        os: data.os || null,
        browser: data.browser || null,
        placement: data.placement || null,
        geoState: data.geo_state || null,
        ipAddress: data.ip_address || clientIp || null,
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
        pageUrl: data.page_url || null,
        screenResolution: data.screen_resolution || null,
        viewport: data.viewport || null,
        language: data.language || null,
        selectedState: data.selected_state || null,
        country: data.country || null,
        browserVersion: data.browser_version || null,
        osVersion: data.os_version || null,
        ipType: data.ip_type || null,
      });

      (async () => {
        try {
          const activeRules = await storage.getActiveSignalRules();
          if (activeRules.length === 0) return;

          const eventContext: EventContext = {
            eventType: data.event_type || "step_complete",
            page: data.page,
            pageType: data.page_type,
            domain: data.domain,
            stepNumber: data.step_number,
            stepName: data.step_name,
            selectedValue: data.selected_value || null,
            timeOnStep: data.time_on_step || null,
            deviceType: data.device_type || null,
            geoState: data.geo_state || null,
            email: data.email || null,
            phone: data.phone || null,
            quizAnswers: (data.quiz_answers as Record<string, any>) || null,
          };

          const matchingRules = activeRules.filter(rule =>
            rule.triggerEvent === eventContext.eventType &&
            evaluateRuleConditions(rule.conditions as SignalRuleConditions, eventContext)
          );

          if (matchingRules.length === 0) return;

          const pageLand = await storage.getSessionPageLandEvent(data.session_id);

          const signalData = {
            eventId: event.eventId,
            sessionId: event.sessionId,
            eventTimestamp: event.eventTimestamp,
            pageUrl: event.pageUrl,
            email: event.email,
            phone: event.phone,
            firstName: event.firstName,
            lastName: event.lastName,
            geoState: event.geoState,
            country: event.country,
            externalId: event.externalId || pageLand?.externalId || null,
            ipAddress: event.ipAddress || pageLand?.ipAddress || null,
            userAgent: event.userAgent || pageLand?.userAgent || null,
            fbp: event.fbp || pageLand?.fbp || null,
            fbc: event.fbc || pageLand?.fbc || null,
            fbclid: event.fbclid || pageLand?.fbclid || null,
          };

          for (const rule of matchingRules) {
            const value = computeRuleValue(rule.customValue, eventContext);
            const tierName = rule.metaEventName.toLowerCase().includes("disqualified") ? "disqualified"
              : rule.metaEventName.toLowerCase().includes("highvalue") ? "high_value_customer"
              : rule.metaEventName.toLowerCase().includes("lowvalue") ? "low_value_customer"
              : "qualified";

            await storage.updateEventLeadTier(event.id, tierName);

            const eventSignalData = tierName === "disqualified"
              ? { ...signalData, email: null, phone: null, firstName: null, lastName: null }
              : signalData;

            const result = await fireAudienceSignal(
              rule.metaEventName,
              eventSignalData,
              value,
              rule.contentName || data.page,
            );

            await storage.insertSignalFireLog({
              ruleId: rule.id,
              ruleName: rule.name,
              eventId: event.id,
              sessionId: data.session_id,
              metaEventName: rule.metaEventName,
              status: result.success ? "success" : "failed",
              errorMessage: result.error || null,
              eventValue: value,
            });

            console.log(`[Signal Rules] Rule "${rule.name}" matched for session ${data.session_id}, fired ${rule.metaEventName}, status: ${result.success ? "success" : "failed"}`);
          }
        } catch (err) {
          console.error("[Signal Rules] Fire-and-forget error:", err);
        }
      })();

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
      const validGroups = ["domain", "deviceType", "utmSource", "utmCampaign", "utmMedium", "page", "geoState", "selectedState", "hourOfDay"];
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

  app.get("/api/analytics/sessions", isAuthenticated, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 25));
      const search = req.query.search as string | undefined;
      const filters = parseFilters(req.query);
      const sessions = await storage.getSessionLogs(filters, page, limit, search);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching session logs:", error);
      res.status(500).json({ message: "Failed to fetch session logs" });
    }
  });

  app.get("/api/analytics/logs", isAuthenticated, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const search = req.query.search as string | undefined;
      const filters = parseFilters(req.query);
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

  app.delete("/api/analytics/events/sessions", isAuthenticated, async (req, res) => {
    try {
      const { sessionIds } = req.body;
      if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
        return res.status(400).json({ message: "sessionIds array required" });
      }
      const count = await storage.deleteEventsBySessions(sessionIds);
      res.json({ message: `Deleted ${count} events for ${sessionIds.length} sessions`, count });
    } catch (error) {
      console.error("Error bulk deleting sessions:", error);
      res.status(500).json({ message: "Failed to bulk delete sessions" });
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

  const RETELL_API_KEY = process.env.retell_api_key;

  app.get("/api/retell/calls", isAuthenticated, async (req, res) => {
    try {
      if (!RETELL_API_KEY) return res.status(500).json({ message: "Retell API key not configured" });
      const phone = req.query.phone as string;
      if (!phone) return res.status(400).json({ message: "phone parameter required" });

      const normalized = phone.replace(/\D/g, "");
      const e164 = normalized.startsWith("1") ? `+${normalized}` : `+1${normalized}`;
      const normWith1 = normalized.startsWith("1") ? normalized : `1${normalized}`;

      const matchPhone = (num: string) => {
        const d = (num || "").replace(/\D/g, "");
        return d === normWith1 || d === normalized;
      };

      let matched: any[] = [];
      let paginationKey: string | undefined;
      let pages = 0;
      const MAX_PAGES = 5;

      while (pages < MAX_PAGES) {
        const body: any = {
          filter_criteria: { call_type: ["phone_call"] },
          sort_order: "descending",
          limit: 200,
        };
        if (paginationKey) body.pagination_key = paginationKey;

        const response = await fetch("https://api.retellai.com/v2/list-calls", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error("Retell API error:", response.status, text);
          return res.status(response.status).json({ message: "Retell API error", detail: text });
        }

        const batch: any[] = await response.json();
        if (batch.length === 0) break;

        for (const c of batch) {
          if (matchPhone(c.to_number) || matchPhone(c.from_number)) {
            matched.push(c);
          }
        }

        if (batch.length < 200) break;
        paginationKey = batch[batch.length - 1].call_id;
        pages++;
      }

      const isBlocked = await storage.isPhoneBlocked(phone);

      const calls = matched.map((c: any) => ({
        callId: c.call_id,
        callType: c.call_type,
        direction: c.direction || "outbound",
        fromNumber: c.from_number,
        toNumber: c.to_number,
        callStatus: c.call_status,
        agentName: c.agent_name,
        startTimestamp: c.start_timestamp,
        endTimestamp: c.end_timestamp,
        durationMs: c.duration_ms,
        transcript: c.transcript,
        recordingUrl: c.recording_url,
        disconnectionReason: c.disconnection_reason,
        callAnalysis: c.call_analysis ? {
          callSummary: c.call_analysis.call_summary,
          userSentiment: c.call_analysis.user_sentiment,
          callSuccessful: c.call_analysis.call_successful,
          inVoicemail: c.call_analysis.in_voicemail,
        } : null,
        callCost: c.call_cost ? {
          totalDurationSeconds: c.call_cost.total_duration_seconds,
          combinedCost: c.call_cost.combined_cost,
        } : null,
      }));

      res.json({ calls, isBlocked, phone: e164 });
    } catch (error) {
      console.error("Error fetching Retell calls:", error);
      res.status(500).json({ message: "Failed to fetch Retell call data" });
    }
  });

  app.get("/api/retell/recording/:callId", isAuthenticated, async (req, res) => {
    try {
      if (!RETELL_API_KEY) return res.status(500).json({ message: "Retell API key not configured" });

      const response = await fetch(`https://api.retellai.com/v2/get-call/${req.params.callId}`, {
        headers: { "Authorization": `Bearer ${RETELL_API_KEY}` },
      });

      if (!response.ok) {
        return res.status(response.status).json({ message: "Retell API error" });
      }

      const call: any = await response.json();
      res.json({
        recordingUrl: call.recording_url,
        transcript: call.transcript,
        callAnalysis: call.call_analysis,
      });
    } catch (error) {
      console.error("Error fetching Retell recording:", error);
      res.status(500).json({ message: "Failed to fetch recording" });
    }
  });

  app.get("/api/retell/blocked", isAuthenticated, async (_req, res) => {
    try {
      const numbers = await storage.getBlockedNumbers();
      res.json(numbers);
    } catch (error) {
      console.error("Error fetching blocked numbers:", error);
      res.status(500).json({ message: "Failed to fetch blocked numbers" });
    }
  });

  app.post("/api/retell/block", isAuthenticated, async (req, res) => {
    try {
      const { phone, reason } = req.body;
      if (!phone) return res.status(400).json({ message: "phone required" });
      const blocked = await storage.blockPhone(phone, reason);
      res.json(blocked);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Phone number already blocked" });
      }
      console.error("Error blocking number:", error);
      res.status(500).json({ message: "Failed to block number" });
    }
  });

  app.post("/api/retell/bulk-unblock", isAuthenticated, async (req, res) => {
    try {
      const { phones } = req.body;
      if (!Array.isArray(phones) || phones.length === 0) {
        return res.status(400).json({ message: "phones array required" });
      }
      const count = await storage.bulkUnblockPhones(phones);
      res.json({ message: `Unblocked ${count} numbers`, count });
    } catch (error) {
      console.error("Error bulk unblocking:", error);
      res.status(500).json({ message: "Failed to bulk unblock" });
    }
  });

  app.delete("/api/retell/block/:phone", isAuthenticated, async (req, res) => {
    try {
      await storage.unblockPhone(decodeURIComponent(req.params.phone));
      res.json({ message: "Number unblocked" });
    } catch (error) {
      console.error("Error unblocking number:", error);
      res.status(500).json({ message: "Failed to unblock number" });
    }
  });

  app.get("/api/facebook/status", isAuthenticated, async (_req, res) => {
    res.json({ configured: facebook.isConfigured() });
  });

  app.get("/api/facebook/ad-accounts", isAuthenticated, async (_req, res) => {
    try {
      if (!facebook.isConfigured()) {
        return res.status(500).json({ message: "Facebook API not configured" });
      }
      const accounts = await facebook.listAdAccounts();
      res.json(accounts);
    } catch (error) {
      if (error instanceof facebook.FacebookApiError) {
        return res.status(error.httpStatus).json({ message: error.message, code: error.code });
      }
      console.error("Error fetching ad accounts:", error);
      res.status(500).json({ message: "Failed to fetch ad accounts" });
    }
  });

  app.get("/api/facebook/account-insights", isAuthenticated, async (req, res) => {
    try {
      if (!facebook.isConfigured()) {
        return res.status(500).json({ message: "Facebook API not configured" });
      }
      const adAccountId = req.query.adAccountId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!adAccountId || !startDate || !endDate) {
        return res.status(400).json({ message: "adAccountId, startDate, endDate required" });
      }
      const insights = await facebook.getAccountInsights(adAccountId, startDate, endDate);
      res.json(insights);
    } catch (error) {
      if (error instanceof facebook.FacebookApiError) {
        return res.status(error.httpStatus).json({ message: error.message, code: error.code });
      }
      console.error("Error fetching account insights:", error);
      res.status(500).json({ message: "Failed to fetch account insights" });
    }
  });

  app.get("/api/facebook/campaigns", isAuthenticated, async (req, res) => {
    try {
      if (!facebook.isConfigured()) {
        return res.status(500).json({ message: "Facebook API not configured" });
      }
      const adAccountId = req.query.adAccountId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!adAccountId || !startDate || !endDate) {
        return res.status(400).json({ message: "adAccountId, startDate, endDate required" });
      }
      const campaigns = await facebook.getCampaignInsights(adAccountId, startDate, endDate);
      res.json(campaigns);
    } catch (error) {
      if (error instanceof facebook.FacebookApiError) {
        return res.status(error.httpStatus).json({ message: error.message, code: error.code });
      }
      console.error("Error fetching campaign insights:", error);
      res.status(500).json({ message: "Failed to fetch campaign insights" });
    }
  });

  app.get("/api/facebook/adsets", isAuthenticated, async (req, res) => {
    try {
      if (!facebook.isConfigured()) {
        return res.status(500).json({ message: "Facebook API not configured" });
      }
      const adAccountId = req.query.adAccountId as string;
      const campaignId = req.query.campaignId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!adAccountId || !campaignId || !startDate || !endDate) {
        return res.status(400).json({ message: "adAccountId, campaignId, startDate, endDate required" });
      }
      const adsets = await facebook.getAdsetInsights(adAccountId, campaignId, startDate, endDate);
      res.json(adsets);
    } catch (error) {
      if (error instanceof facebook.FacebookApiError) {
        return res.status(error.httpStatus).json({ message: error.message, code: error.code });
      }
      console.error("Error fetching adset insights:", error);
      res.status(500).json({ message: "Failed to fetch adset insights" });
    }
  });

  app.get("/api/facebook/ads", isAuthenticated, async (req, res) => {
    try {
      if (!facebook.isConfigured()) {
        return res.status(500).json({ message: "Facebook API not configured" });
      }
      const adAccountId = req.query.adAccountId as string;
      const adsetId = req.query.adsetId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!adAccountId || !adsetId || !startDate || !endDate) {
        return res.status(400).json({ message: "adAccountId, adsetId, startDate, endDate required" });
      }
      const ads = await facebook.getAdInsights(adAccountId, adsetId, startDate, endDate);
      res.json(ads);
    } catch (error) {
      if (error instanceof facebook.FacebookApiError) {
        return res.status(error.httpStatus).json({ message: error.message, code: error.code });
      }
      console.error("Error fetching ad insights:", error);
      res.status(500).json({ message: "Failed to fetch ad insights" });
    }
  });

  app.get("/api/facebook/daily-insights", isAuthenticated, async (req, res) => {
    try {
      if (!facebook.isConfigured()) {
        return res.status(500).json({ message: "Facebook API not configured" });
      }
      const adAccountId = req.query.adAccountId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!adAccountId || !startDate || !endDate) {
        return res.status(400).json({ message: "adAccountId, startDate, endDate required" });
      }
      const insights = await facebook.getDailyInsights(adAccountId, startDate, endDate);
      res.json(insights);
    } catch (error) {
      if (error instanceof facebook.FacebookApiError) {
        return res.status(error.httpStatus).json({ message: error.message, code: error.code });
      }
      console.error("Error fetching daily insights:", error);
      res.status(500).json({ message: "Failed to fetch daily insights" });
    }
  });

  app.post("/api/facebook/refresh-token", isAuthenticated, async (_req, res) => {
    try {
      const result = await facebook.refreshAccessToken();
      const expiresInDays = Math.round(result.expires_in / 86400);
      res.json({
        ok: true,
        newToken: result.access_token,
        expiresInDays,
        message: `Token refreshed successfully. New token expires in ${expiresInDays} days. Update the FACEBOOK_ACCESS_TOKEN secret with the new token value, then revoke the old one.`,
      });
    } catch (error) {
      if (error instanceof facebook.FacebookApiError) {
        return res.status(error.httpStatus).json({ message: error.message, code: error.code });
      }
      console.error("Error refreshing token:", error);
      res.status(500).json({ message: "Failed to refresh token" });
    }
  });

  app.post("/api/facebook/revoke-token", isAuthenticated, async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "token is required in body" });
      }
      const success = await facebook.revokeAccessToken(token);
      res.json({ ok: success, message: success ? "Token revoked successfully" : "Revocation returned false" });
    } catch (error) {
      if (error instanceof facebook.FacebookApiError) {
        return res.status(error.httpStatus).json({ message: error.message, code: error.code });
      }
      console.error("Error revoking token:", error);
      res.status(500).json({ message: "Failed to revoke token" });
    }
  });

  app.get("/api/meta-conversions/status", isAuthenticated, async (_req, res) => {
    const pixelId = process.env.FACEBOOK_PIXEL_ID;
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    res.json({
      configured: !!(pixelId && accessToken),
      hasPixelId: !!pixelId,
      hasAccessToken: !!accessToken,
    });
  });

  app.get("/api/meta-conversions/missing", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, adId, audience } = req.query as {
        startDate?: string;
        endDate?: string;
        adId?: string;
        audience?: string;
      };

      const formCompletes = await storage.getFormCompleteEventsWithFbData({
        startDate,
        endDate,
        adId,
        page: audience,
      });

      const uploadStatuses = await storage.getUploadedEventStatuses();

      const events = formCompletes.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        eventId: e.eventId,
        eventTimestamp: e.eventTimestamp,
        page: e.page,
        domain: e.domain,
        hasFirstName: !!e.firstName,
        hasLastName: !!e.lastName,
        nameInitials: [e.firstName?.[0], e.lastName?.[0]].filter(Boolean).join("") || null,
        maskedEmail: e.email ? e.email.replace(/^(.{2})(.*)(@.*)$/, "$1***$3") : null,
        maskedPhone: e.phone ? e.phone.replace(/^(\d{3})(\d+)(\d{2})$/, "$1***$3") : null,
        adId: e.sessionAdId || e.adId,
        adName: e.sessionAdName || e.adName,
        adsetId: e.sessionAdsetId || e.adsetId,
        adsetName: e.sessionAdsetName || e.adsetName,
        campaignId: e.sessionCampaignId || e.campaignId,
        campaignName: e.sessionCampaignName || e.campaignName,
        fbclid: !!(e.sessionFbclid || e.fbclid),
        fbp: !!(e.sessionFbp || e.fbp),
        fbc: !!(e.sessionFbc || e.fbc),
        externalId: !!(e.sessionExternalId || e.externalId),
        ipAddress: !!e.ipAddress,
        hasEmail: !!e.email,
        hasPhone: !!e.phone,
        uploaded: uploadStatuses.has(e.id),
        uploadStatus: uploadStatuses.get(e.id) || "pending",
        geoState: e.geoState,
        deviceType: e.deviceType,
        placement: e.sessionPlacement || e.placement,
        utmSource: e.sessionUtmSource || e.utmSource,
        utmMedium: e.sessionUtmMedium || e.utmMedium,
        utmCampaign: e.sessionUtmCampaign || e.utmCampaign,
        utmContent: e.sessionUtmContent || e.utmContent,
        utmTerm: e.sessionUtmTerm || e.utmTerm,
        utmId: e.sessionUtmId || e.utmId,
      }));

      res.json({
        events,
        total: events.length,
        uploaded: events.filter(e => e.uploadStatus === "sent").length,
        synced: events.filter(e => e.uploadStatus === "synced").length,
      });
    } catch (error) {
      console.error("Error fetching missing conversions:", error);
      res.status(500).json({ message: "Failed to fetch conversion data" });
    }
  });

  app.get("/api/meta-conversions/comparison", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, adAccountId } = req.query as {
        startDate?: string;
        endDate?: string;
        adAccountId?: string;
      };

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const ourCounts = await storage.getFormCompleteCountsByAd({ startDate, endDate });

      let metaInsights: facebook.NormalizedInsight[] = [];
      if (adAccountId && facebook.isConfigured()) {
        try {
          metaInsights = await facebook.getAdInsightsAll(adAccountId, startDate, endDate);
        } catch (e) {
          console.error("Error fetching Meta ad insights for comparison:", e);
        }
      }

      const metaLeadsByAd = new Map<string, number>();
      for (const insight of metaInsights) {
        if (insight.adId) {
          metaLeadsByAd.set(insight.adId, (metaLeadsByAd.get(insight.adId) || 0) + insight.leads);
        }
      }

      const comparison = ourCounts.map((our) => ({
        adId: our.adId,
        adName: our.adName,
        campaignId: our.campaignId,
        campaignName: our.campaignName,
        adsetId: our.adsetId,
        adsetName: our.adsetName,
        ourLeads: our.count,
        metaLeads: metaLeadsByAd.get(our.adId) ?? null,
        difference: metaLeadsByAd.has(our.adId) ? our.count - metaLeadsByAd.get(our.adId)! : null,
      }));

      comparison.sort((a, b) => (b.difference ?? 0) - (a.difference ?? 0));

      res.json({ comparison });
    } catch (error) {
      console.error("Error fetching conversion comparison:", error);
      res.status(500).json({ message: "Failed to fetch comparison data" });
    }
  });

  app.post("/api/meta-conversions/upload", isAuthenticated, async (req, res) => {
    try {
      const pixelId = process.env.FACEBOOK_PIXEL_ID;
      const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

      if (!pixelId || !accessToken) {
        return res.status(400).json({ message: "FACEBOOK_PIXEL_ID and FACEBOOK_ACCESS_TOKEN must be configured" });
      }

      const { eventIds, testMode, testEventCode: userTestCode } = req.body as { eventIds: number[]; testMode?: boolean; testEventCode?: string };

      if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ message: "eventIds array is required" });
      }

      if (eventIds.length > 100) {
        return res.status(400).json({ message: "Maximum 100 events per upload" });
      }

      const formCompletes = await storage.getFormCompleteEventsWithFbData({});
      const eventMap = new Map(formCompletes.map(e => [e.id, e]));
      const uploadedIds = await storage.getUploadedEventIds();

      const results: { eventId: number; status: string; message: string }[] = [];
      const eventsToSend = [];

      for (const id of eventIds) {
        const event = eventMap.get(id);
        if (!event) {
          results.push({ eventId: id, status: "error", message: "Event not found" });
          continue;
        }
        if (uploadedIds.has(id) && !testMode) {
          results.push({ eventId: id, status: "skipped", message: "Already uploaded" });
          continue;
        }
        eventsToSend.push({ trackingEvent: event, convEvent: buildConversionEvent({
          eventId: event.eventId,
          sessionId: event.sessionId,
          eventTimestamp: event.eventTimestamp,
          pageUrl: event.pageUrl,
          email: event.email,
          phone: event.phone,
          firstName: event.firstName,
          lastName: event.lastName,
          geoState: event.geoState,
          country: event.country,
          externalId: event.sessionExternalId || event.externalId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          fbp: event.sessionFbp || event.fbp,
          fbc: event.sessionFbc || event.fbc,
          fbclid: event.sessionFbclid || event.fbclid,
        }) });
      }

      if (eventsToSend.length === 0) {
        return res.json({ results, sent: 0, received: 0 });
      }

      const testEventCode = testMode ? (userTestCode || "TEST_CAPI_" + Date.now()) : undefined;

      const batchSize = 50;
      let totalReceived = 0;

      for (let i = 0; i < eventsToSend.length; i += batchSize) {
        const batch = eventsToSend.slice(i, i + batchSize);
        try {
          console.log(`[CAPI] Sending ${batch.length} events to pixel ${pixelId} ${testEventCode ? `(test: ${testEventCode})` : "(LIVE)"}`);
          const response = await sendConversionEvents(
            pixelId,
            accessToken,
            batch.map(b => b.convEvent),
            testEventCode,
          );
          console.log(`[CAPI] Response: events_received=${response.events_received}, fbtrace_id=${response.fbtrace_id}, messages=${JSON.stringify(response.messages || [])}`);
          totalReceived += response.events_received;

          for (const item of batch) {
            await storage.recordMetaUpload({
              trackingEventId: item.trackingEvent.id,
              sessionId: item.trackingEvent.sessionId,
              eventId: item.trackingEvent.eventId || null,
              metaEventId: item.convEvent.eventId,
              pixelId: testMode ? "TEST" : pixelId,
              status: "sent",
              eventsReceived: response.events_received,
              fbtraceId: response.fbtrace_id || null,
              errorMessage: null,
            });
            results.push({ eventId: item.trackingEvent.id, status: "sent", message: `Sent successfully (fbtrace: ${response.fbtrace_id})` });
          }
        } catch (error) {
          const errMsg = error instanceof MetaConversionError ? error.message : String(error);
          for (const item of batch) {
            await storage.recordMetaUpload({
              trackingEventId: item.trackingEvent.id,
              sessionId: item.trackingEvent.sessionId,
              eventId: item.trackingEvent.eventId || null,
              metaEventId: item.convEvent.eventId,
              pixelId,
              status: "error",
              eventsReceived: null,
              fbtraceId: null,
              errorMessage: errMsg,
            });
            results.push({ eventId: item.trackingEvent.id, status: "error", message: errMsg });
          }
        }
      }

      res.json({
        results,
        sent: eventsToSend.length,
        received: totalReceived,
        testMode: !!testMode,
        testEventCode,
        pixelId,
      });
    } catch (error) {
      console.error("Error uploading conversions:", error);
      res.status(500).json({ message: "Failed to upload conversions" });
    }
  });

  app.post("/api/meta-conversions/mark-synced", isAuthenticated, async (req, res) => {
    try {
      const { eventIds } = req.body as { eventIds: number[] };
      if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ message: "eventIds array is required" });
      }
      if (eventIds.length > 500) {
        return res.status(400).json({ message: "Maximum 500 events per request" });
      }
      const count = await storage.bulkMarkSynced(eventIds);
      res.json({ marked: count, total: eventIds.length });
    } catch (error) {
      console.error("Error marking events as synced:", error);
      res.status(500).json({ message: "Failed to mark events as synced" });
    }
  });

  app.get("/api/meta-conversions/history", isAuthenticated, async (_req, res) => {
    try {
      const history = await storage.getMetaUploadHistory(100);
      res.json({ history });
    } catch (error) {
      console.error("Error fetching upload history:", error);
      res.status(500).json({ message: "Failed to fetch upload history" });
    }
  });

  const policySoldSchema = z.object({
    session_id: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    policy_type: z.string().min(1),
    annual_premium: z.number().positive(),
    geo_state: z.string().max(10).optional(),
    country: z.string().max(10).optional(),
  });

  app.post("/api/webhook/policy-sold", async (req, res) => {
    const apiKey = req.headers["x-api-key"] as string;
    const expectedKey = process.env.WEBHOOK_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const parsed = policySoldSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      }

      const data = parsed.data;

      const pageLand = await storage.getSessionPageLandEvent(data.session_id);

      const tier = classifyCustomerTier(data.annual_premium);
      const capiEventName = getCapiEventName(tier);

      const signalData = {
        eventId: `policy_${data.session_id}`,
        sessionId: data.session_id,
        eventTimestamp: new Date(),
        pageUrl: null,
        email: data.email || null,
        phone: data.phone || null,
        firstName: data.first_name || null,
        lastName: data.last_name || null,
        geoState: data.geo_state || pageLand?.geoState || null,
        country: data.country || pageLand?.country || null,
        externalId: pageLand?.externalId || null,
        ipAddress: pageLand?.ipAddress || null,
        userAgent: pageLand?.userAgent || null,
        fbp: pageLand?.fbp || null,
        fbc: pageLand?.fbc || null,
        fbclid: pageLand?.fbclid || null,
      };

      const result = await fireAudienceSignal(capiEventName, signalData, data.annual_premium, data.policy_type);

      console.log(`[Webhook] Policy sold: session=${data.session_id}, tier=${tier}, premium=${data.annual_premium}, capi=${result.success}`);

      res.json({ ok: true, tier, capiEventName, capiFired: result.success });
    } catch (error) {
      console.error("[Webhook] Policy sold error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/meta-conversions/signal-log", isAuthenticated, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const result = await storage.getSignalFireLogs({ startDate, endDate, page, limit });
      res.json({ logs: result.logs, total: result.total, page, totalPages: Math.ceil(result.total / limit) });
    } catch (error) {
      console.error("Error fetching signal fire logs:", error);
      res.status(500).json({ error: "Failed to fetch signal fire logs" });
    }
  });

  app.get("/api/meta-conversions/signal-rules", isAuthenticated, async (req, res) => {
    try {
      const rules = await storage.getSignalRules();
      res.json({ rules });
    } catch (error) {
      console.error("Error fetching signal rules:", error);
      res.status(500).json({ message: "Failed to fetch signal rules" });
    }
  });

  app.post("/api/meta-conversions/signal-rules", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(200),
        triggerEvent: z.string().min(1).max(30),
        conditions: z.record(z.any()).default({}),
        metaEventName: z.string().min(1).max(100),
        customValue: z.number().int().optional().nullable(),
        currency: z.string().max(10).default("USD"),
        contentName: z.string().max(200).optional().nullable(),
        active: z.number().int().min(0).max(1).default(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      }
      const rule = await storage.createSignalRule(parsed.data);
      res.json({ rule });
    } catch (error) {
      console.error("Error creating signal rule:", error);
      res.status(500).json({ message: "Failed to create signal rule" });
    }
  });

  app.put("/api/meta-conversions/signal-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid rule ID" });

      const schema = z.object({
        name: z.string().min(1).max(200).optional(),
        triggerEvent: z.string().min(1).max(30).optional(),
        conditions: z.record(z.any()).optional(),
        metaEventName: z.string().min(1).max(100).optional(),
        customValue: z.number().int().optional().nullable(),
        currency: z.string().max(10).optional(),
        contentName: z.string().max(200).optional().nullable(),
        active: z.number().int().min(0).max(1).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      }
      const rule = await storage.updateSignalRule(id, parsed.data);
      if (!rule) return res.status(404).json({ error: "Rule not found" });
      res.json({ rule });
    } catch (error) {
      console.error("Error updating signal rule:", error);
      res.status(500).json({ message: "Failed to update signal rule" });
    }
  });

  app.delete("/api/meta-conversions/signal-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid rule ID" });
      const deleted = await storage.deleteSignalRule(id);
      if (!deleted) return res.status(404).json({ error: "Rule not found" });
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting signal rule:", error);
      res.status(500).json({ message: "Failed to delete signal rule" });
    }
  });

  app.post("/api/meta-conversions/reprocess-untiered", isAuthenticated, async (req, res) => {
    try {
      const untieredEvents = await storage.getUntieredFormCompleteEvents(200);
      if (untieredEvents.length === 0) {
        return res.json({ processed: 0, message: "No un-tiered events found" });
      }

      const activeRules = await storage.getActiveSignalRules();
      if (activeRules.length === 0) {
        return res.json({ processed: 0, message: "No active signal rules" });
      }

      let processed = 0;
      for (const event of untieredEvents) {
        const eventContext: EventContext = {
          eventType: event.eventType || "form_complete",
          page: event.page,
          pageType: event.pageType,
          domain: event.domain,
          stepNumber: event.stepNumber,
          stepName: event.stepName,
          selectedValue: event.selectedValue || null,
          timeOnStep: event.timeOnStep || null,
          deviceType: event.deviceType || null,
          geoState: event.geoState || null,
          email: event.email || null,
          phone: event.phone || null,
          quizAnswers: (event.quizAnswers as Record<string, any>) || null,
        };

        const matchingRules = activeRules.filter(rule =>
          rule.triggerEvent === eventContext.eventType &&
          evaluateRuleConditions(rule.conditions as SignalRuleConditions, eventContext)
        );

        if (matchingRules.length === 0) continue;

        const pageLand = await storage.getSessionPageLandEvent(event.sessionId);

        for (const rule of matchingRules) {
          const value = computeRuleValue(rule.customValue, eventContext);
          const tierName = rule.metaEventName.toLowerCase().includes("disqualified") ? "disqualified"
            : rule.metaEventName.toLowerCase().includes("highvalue") ? "high_value_customer"
            : rule.metaEventName.toLowerCase().includes("lowvalue") ? "low_value_customer"
            : "qualified";

          await storage.updateEventLeadTier(event.id, tierName);

          const signalData = {
            eventId: event.eventId,
            sessionId: event.sessionId,
            eventTimestamp: event.eventTimestamp,
            pageUrl: event.pageUrl,
            email: event.email,
            phone: event.phone,
            firstName: event.firstName,
            lastName: event.lastName,
            geoState: event.geoState,
            country: event.country,
            externalId: event.externalId || pageLand?.externalId || null,
            ipAddress: event.ipAddress || pageLand?.ipAddress || null,
            userAgent: event.userAgent || pageLand?.userAgent || null,
            fbp: event.fbp || pageLand?.fbp || null,
            fbc: event.fbc || pageLand?.fbc || null,
            fbclid: event.fbclid || pageLand?.fbclid || null,
          };

          const eventSignalData = tierName === "disqualified"
            ? { ...signalData, email: null, phone: null, firstName: null, lastName: null }
            : signalData;

          const result = await fireAudienceSignal(
            rule.metaEventName,
            eventSignalData,
            value,
            rule.contentName || event.page,
          );

          await storage.insertSignalFireLog({
            ruleId: rule.id,
            ruleName: rule.name,
            eventId: event.id,
            sessionId: event.sessionId,
            metaEventName: rule.metaEventName,
            status: result.success ? "success" : "failed",
            errorMessage: result.error || null,
            eventValue: value,
          });

          console.log(`[Reprocess] Rule "${rule.name}" matched event ${event.id}, fired ${rule.metaEventName}, status: ${result.success ? "success" : "failed"}`);
        }
        processed++;
      }

      res.json({ processed, total: untieredEvents.length });
    } catch (error) {
      console.error("Error reprocessing un-tiered events:", error);
      res.status(500).json({ message: "Failed to reprocess events" });
    }
  });

  app.get("/api/meta-conversions/audience-stats", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, audience } = req.query as { startDate?: string; endDate?: string; audience?: string };
      const stats = await storage.getLeadTierStats({
        startDate,
        endDate,
        page: audience && audience !== "__all__" ? audience : undefined,
      });
      res.json({ stats });
    } catch (error) {
      console.error("Error fetching audience stats:", error);
      res.status(500).json({ message: "Failed to fetch audience stats" });
    }
  });

  app.get("/api/meta-conversions/audience-events", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, audience, tier, page: pageStr } = req.query as {
        startDate?: string; endDate?: string; audience?: string; tier?: string; page?: string;
      };
      const page = Math.max(1, parseInt(pageStr || "1", 10));
      const result = await storage.getLeadTierEvents(
        {
          startDate,
          endDate,
          page: audience && audience !== "__all__" ? audience : undefined,
          tier: tier && tier !== "__all__" ? tier : undefined,
        },
        page,
        50,
      );
      res.json({
        events: result.events,
        total: result.total,
        page,
        totalPages: Math.max(1, Math.ceil(result.total / 50)),
      });
    } catch (error) {
      console.error("Error fetching audience events:", error);
      res.status(500).json({ message: "Failed to fetch audience events" });
    }
  });

  return httpServer;
}
