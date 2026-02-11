import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity"
      data-testid="button-copy-code"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  return (
    <div className="relative group/code">
      <CopyButton text={code} />
      <pre className="bg-muted rounded-md p-4 overflow-x-auto text-sm font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function EndpointSection({
  method,
  path,
  description,
  auth,
  queryParams,
  requestBody,
  responseExample,
  notes,
  testId,
}: {
  method: "GET" | "POST" | "OPTIONS";
  path: string;
  description: string;
  auth: boolean;
  queryParams?: { name: string; type: string; description: string; required?: boolean }[];
  requestBody?: string;
  responseExample: string;
  notes?: string[];
  testId: string;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    POST: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    OPTIONS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  };

  return (
    <Card className="p-5" data-testid={testId}>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-sm font-mono font-semibold">{path}</code>
        {auth && <Badge variant="outline" className="text-xs">Auth Required</Badge>}
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      {queryParams && queryParams.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Query Parameters</h4>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {queryParams.map((p) => (
                  <tr key={p.name} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">
                      {p.name}
                      {p.required && <span className="text-destructive ml-1">*</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{p.type}</td>
                    <td className="px-3 py-2 text-xs">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {requestBody && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Request Body</h4>
          <CodeBlock code={requestBody} />
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Response Example</h4>
        <CodeBlock code={responseExample} />
      </div>

      {notes && notes.length > 0 && (
        <div className="mt-4 space-y-1">
          {notes.map((note, i) => (
            <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span className="shrink-0 mt-0.5 w-1 h-1 rounded-full bg-muted-foreground/50 inline-block" />
              {note}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

const FILTER_PARAMS = [
  { name: "page", type: "string", description: '"seniors", "veterans", or "first-responders"' },
  { name: "pageType", type: "string", description: '"lead" or "call"' },
  { name: "domain", type: "string", description: '"blueskylife.net" or "blueskylife.io"' },
  { name: "startDate", type: "string", description: "Start date (YYYY-MM-DD)" },
  { name: "endDate", type: "string", description: "End date (YYYY-MM-DD)" },
  { name: "utmSource", type: "string", description: "UTM source filter" },
  { name: "utmCampaign", type: "string", description: "UTM campaign filter" },
  { name: "utmMedium", type: "string", description: "UTM medium filter" },
  { name: "utmContent", type: "string", description: "UTM content filter" },
  { name: "deviceType", type: "string", description: '"mobile", "desktop", or "tablet"' },
];

export default function ApiDocsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [user, authLoading]);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-api-docs-title">API Documentation</h1>
        <p className="text-sm text-muted-foreground">Integrate your landing pages with TrackingJunction</p>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-2" data-testid="text-overview-title">Overview</h2>
        <p className="text-sm text-muted-foreground mb-3">
          TrackingJunction provides a REST API for ingesting anonymous tracking events from your landing pages
          and retrieving aggregated analytics. Events are sent from blueskylife.net and blueskylife.io via
          client-side JavaScript.
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">Base URL</Badge>
            <code className="text-xs font-mono">https://trackingjunction.com</code>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">Format</Badge>
            <span className="text-xs">JSON request/response (application/json)</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">CORS</Badge>
            <span className="text-xs">Enabled for blueskylife.net and blueskylife.io only</span>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-1" data-testid="text-section-event-ingestion">Event Ingestion</h2>
        <p className="text-sm text-muted-foreground mb-4">Send tracking events from your landing pages. No authentication required -- events are accepted from allowed origins.</p>
      </div>

      <EndpointSection
        testId="endpoint-post-events"
        method="POST"
        path="/api/events"
        description="Record a tracking event. Called from your landing page JavaScript when a visitor lands, completes a quiz step, or submits a form."
        auth={false}
        requestBody={`{
  "session_id": "a50e8400-e29b-41d4-a716-446655440001",
  "event_id": "evt_1770771632583_3veonwsk5qt",
  "event_type": "step_complete",
  "page": "seniors",
  "page_type": "lead",
  "domain": "blueskylife.net",
  "step_number": 3,
  "step_name": "Budget",
  "selected_value": "$50-$100/month",
  "time_on_step": 8,
  "device_type": "mobile",
  "os": "iOS",
  "browser": "Facebook",
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5...)",
  "referrer": "https://facebook.com",
  "page_url": "https://blueskylife.net/seniors?utm_source=fb",
  "screen_resolution": "390x844",
  "viewport": "390x664",
  "language": "en-US",
  "ip_address": "2600:387:15:401b::4",
  "geo_state": "FL",
  "selected_state": "FL",
  "external_id": "extid_1770771927490_9kur...",
  "fbc": "fb.1.1770771633796.IwZXh0bg...",
  "fbp": "fb.1.1770771632669.73516071...",
  "utm_source": "fb",
  "utm_medium": "paid",
  "utm_campaign": "120240154423180716",
  "utm_content": "120240223154270716",
  "utm_term": "120240223154240716",
  "utm_id": "120240154423180716",
  "placement": "Facebook_Mobile_Feed",
  "media_type": "facebook",
  "campaign_name": "Leads - ABO 1",
  "campaign_id": "120240154423180716",
  "ad_name": "VFE080",
  "ad_id": "120240223154270716",
  "adset_name": "Test 2",
  "adset_id": "120240223154240716",
  "fbclid": "IwZXh0bgNhZW0BMABhZGlk...",
  "quiz_answers": {
    "beneficiary": "Spouse",
    "state": "Florida",
    "budget": "$50-$100/month"
  }
}`}
        responseExample={`{ "ok": true }`}
        notes={[
          'CORS is restricted to origins: blueskylife.net and blueskylife.io (with/without www prefix).',
          'page: Audience name -- "seniors", "veterans", or "first-responders".',
          'page_type: "lead" for lead-gen funnels (8 steps + landing) or "call" for call-in funnels (6 steps + landing).',
          'event_type: "page_land" when visitor first arrives, "step_complete" after each quiz answer, "form_complete" for final form submission.',
          'time_on_step: Seconds (0-3600) the visitor spent on this step before clicking. Optional.',
          'session_id: A UUID v4 generated client-side per visitor session.',
          'event_id: Unique ID per event (different from external_id which is per session).',
          'selected_value: The option the visitor chose at this step (e.g., "Florida", "66-70").',
          'quiz_answers: JSON object that accumulates quiz answers as user progresses. Lead keys: beneficiary, state, budget, age, income. Call keys: state, age, income, budget, purpose.',
          'PII fields (first_name, last_name, email, phone) are only stored when event_type is "form_complete". They are silently ignored for other event types.',
          'Facebook ad fields (campaign_name, campaign_id, ad_name, ad_id, adset_name, adset_id, media_type, fbclid, fbc, fbp) come from URL params or cookies -- absent for organic traffic.',
          'Required fields: session_id, event_id, event_type, page, page_type, domain, step_number, step_name. All other fields are optional.',
        ]}
      />

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-1" data-testid="text-section-event-schema">Event Schema Reference</h2>
        <p className="text-sm text-muted-foreground mb-4">Complete field reference for the <code className="text-xs font-mono">POST /api/events</code> payload, organized by group.</p>
      </div>

      <Card className="p-5">
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full" style={{ fontSize: "11px" }}>
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-2 py-1.5 font-medium">Field</th>
                <th className="text-left px-2 py-1.5 font-medium">Type</th>
                <th className="text-left px-2 py-1.5 font-medium">Req</th>
                <th className="text-left px-2 py-1.5 font-medium">When Sent</th>
                <th className="text-left px-2 py-1.5 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { group: "Required Fields" },
                { field: "session_id", type: "string", req: true, when: "Every event", desc: "UUID grouping all events from one visitor journey" },
                { field: "event_id", type: "string", req: true, when: "Every event", desc: 'Unique ID per event, format: evt_{timestamp}_{random}' },
                { field: "event_type", type: "string", req: true, when: "Every event", desc: 'One of: "page_land", "step_complete", "form_complete"' },
                { field: "page", type: "string", req: true, when: "Every event", desc: 'Audience: "seniors", "veterans", or "first-responders"' },
                { field: "page_type", type: "string", req: true, when: "Every event", desc: 'Funnel type: "lead" or "call"' },
                { field: "domain", type: "string", req: true, when: "Every event", desc: '"blueskylife.net" or "blueskylife.io"' },
                { field: "step_number", type: "integer", req: true, when: "Every event", desc: "0=Landing, 1-5=Quiz, 6=Name, 7=Email, 8=Phone" },
                { field: "step_name", type: "string", req: true, when: "Every event", desc: 'Human-readable step name (e.g., "Landing", "State", "Phone")' },
                { group: "Optional Core Fields" },
                { field: "selected_value", type: "string", req: false, when: "When present", desc: "User's answer for this step" },
                { field: "time_on_step", type: "integer", req: false, when: "When present", desc: "Seconds on previous step (0 for page_land)" },
                { group: "Device & Visitor Fields" },
                { field: "device_type", type: "string", req: false, when: "Every event", desc: '"mobile", "desktop", or "tablet"' },
                { field: "os", type: "string", req: false, when: "Every event", desc: '"macOS", "Windows", "iOS", "Android", "Linux", "ChromeOS", "Unknown"' },
                { field: "browser", type: "string", req: false, when: "Every event", desc: '"Chrome", "Safari", "Firefox", "Edge", "Opera", "Facebook", "Instagram", "Unknown"' },
                { field: "user_agent", type: "string", req: false, when: "Every event", desc: "Full browser user agent string" },
                { field: "referrer", type: "string", req: false, when: "When present", desc: "Referring URL" },
                { field: "page_url", type: "string", req: false, when: "Every event", desc: "Full page URL with path and query params" },
                { field: "screen_resolution", type: "string", req: false, when: "Every event", desc: 'Device screen size (e.g., "1920x1080")' },
                { field: "viewport", type: "string", req: false, when: "Every event", desc: 'Browser viewport size (e.g., "412x915")' },
                { field: "language", type: "string", req: false, when: "Every event", desc: 'Browser language (e.g., "en-US")' },
                { field: "ip_address", type: "string", req: false, when: "Every event", desc: "Visitor's IP address" },
                { field: "geo_state", type: "string", req: false, when: "When present", desc: 'Auto-detected US state code from IP (e.g., "FL")' },
                { field: "selected_state", type: "string", req: false, when: "When present", desc: "State user manually selected in quiz" },
                { group: "Identity / Tracking Fields" },
                { field: "external_id", type: "string", req: false, when: "When present", desc: "Raw external ID for Meta matching" },
                { field: "fbc", type: "string", req: false, when: "When present", desc: "Facebook click ID cookie (_fbc)" },
                { field: "fbp", type: "string", req: false, when: "When present", desc: "Facebook browser ID cookie (_fbp)" },
                { group: "UTM Fields" },
                { field: "utm_source", type: "string", req: false, when: "When present", desc: "UTM source parameter" },
                { field: "utm_medium", type: "string", req: false, when: "When present", desc: "UTM medium parameter" },
                { field: "utm_campaign", type: "string", req: false, when: "When present", desc: "UTM campaign parameter" },
                { field: "utm_content", type: "string", req: false, when: "When present", desc: "UTM content parameter" },
                { field: "utm_term", type: "string", req: false, when: "When present", desc: "UTM term parameter" },
                { field: "utm_id", type: "string", req: false, when: "When present", desc: "UTM ID parameter" },
                { group: "Ad Attribution Fields" },
                { field: "placement", type: "string", req: false, when: "When present", desc: 'Ad placement (e.g., "Facebook_Mobile_Feed")' },
                { field: "media_type", type: "string", req: false, when: "When present", desc: 'Media type (e.g., "facebook")' },
                { field: "campaign_name", type: "string", req: false, when: "When present", desc: 'Campaign name (e.g., "Leads - ABO 1")' },
                { field: "campaign_id", type: "string", req: false, when: "When present", desc: "Campaign ID" },
                { field: "ad_name", type: "string", req: false, when: "When present", desc: 'Ad name (e.g., "VFE080")' },
                { field: "ad_id", type: "string", req: false, when: "When present", desc: "Ad ID" },
                { field: "adset_name", type: "string", req: false, when: "When present", desc: 'Adset name (e.g., "Test 2")' },
                { field: "adset_id", type: "string", req: false, when: "When present", desc: "Adset ID" },
                { field: "fbclid", type: "string", req: false, when: "When present", desc: "Facebook click ID from URL" },
                { group: "Quiz & PII Fields" },
                { field: "quiz_answers", type: "object", req: false, when: "When present", desc: 'Accumulated key-value pairs of quiz answers (e.g., {"state":"Florida","age":"66-70"})' },
                { field: "first_name", type: "string", req: false, when: "form_complete only", desc: "Lead first name" },
                { field: "last_name", type: "string", req: false, when: "form_complete only", desc: "Lead last name" },
                { field: "email", type: "string", req: false, when: "form_complete only", desc: "Lead email address" },
                { field: "phone", type: "string", req: false, when: "form_complete only", desc: "Lead phone number" },
              ].map((row, i) => {
                if ("group" in row && !("field" in row)) {
                  return (
                    <tr key={`group-${i}`} className="border-t bg-muted/30">
                      <td colSpan={5} className="px-2 py-1.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">{row.group}</td>
                    </tr>
                  );
                }
                const r = row as { field: string; type: string; req: boolean; when: string; desc: string };
                return (
                  <tr key={r.field} className="border-t">
                    <td className="px-2 py-1 font-mono" style={{ fontSize: "10px" }}>{r.field}</td>
                    <td className="px-2 py-1 text-muted-foreground" style={{ fontSize: "10px" }}>{r.type}</td>
                    <td className="px-2 py-1" style={{ fontSize: "10px" }}>
                      {r.req ? (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="px-2 py-1" style={{ fontSize: "10px" }}>
                      {r.when === "form_complete only" ? (
                        <span className="text-amber-600 dark:text-amber-400">{r.when}</span>
                      ) : r.when === "When present" ? (
                        <span className="text-muted-foreground">{r.when}</span>
                      ) : (
                        <span>{r.when}</span>
                      )}
                    </td>
                    <td className="px-2 py-1" style={{ fontSize: "10px" }}>{r.desc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-1" data-testid="text-section-funnel-steps">Funnel Step Definitions</h2>
        <p className="text-sm text-muted-foreground mb-4">The expected step sequences for each funnel type.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            Lead-Gen Funnel
            <Badge variant="secondary" className="text-xs">9 steps (0-8)</Badge>
          </h3>
          <ol className="space-y-1.5 text-sm">
            {[
              { n: 0, name: "Landing", type: "page_land" },
              { n: 1, name: "Beneficiary", type: "step_complete" },
              { n: 2, name: "State", type: "step_complete" },
              { n: 3, name: "Budget", type: "step_complete" },
              { n: 4, name: "Age", type: "step_complete" },
              { n: 5, name: "Income", type: "step_complete" },
              { n: 6, name: "Name", type: "step_complete" },
              { n: 7, name: "Email", type: "step_complete" },
              { n: 8, name: "Phone", type: "form_complete" },
            ].map((s) => (
              <li key={s.n} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0">{s.n}</span>
                <span>{s.name}</span>
                <span className="text-xs text-muted-foreground">({s.type})</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            Call-In Funnel
            <Badge variant="secondary" className="text-xs">7 steps (0-6)</Badge>
          </h3>
          <ol className="space-y-1.5 text-sm">
            {[
              { n: 0, name: "Landing", type: "page_land" },
              { n: 1, name: "State", type: "step_complete" },
              { n: 2, name: "Age", type: "step_complete" },
              { n: 3, name: "Income", type: "step_complete" },
              { n: 4, name: "Budget", type: "step_complete" },
              { n: 5, name: "Purpose", type: "step_complete" },
              { n: 6, name: "Call CTA", type: "step_complete" },
            ].map((s) => (
              <li key={s.n} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0">{s.n}</span>
                <span>{s.name}</span>
                <span className="text-xs text-muted-foreground">({s.type})</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-1" data-testid="text-section-analytics">Analytics Endpoints</h2>
        <p className="text-sm text-muted-foreground mb-4">Authenticated endpoints for retrieving aggregated analytics. All accept the same optional filter query parameters.</p>
      </div>

      <Card className="p-5 mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Common Filter Parameters</h4>
        <p className="text-xs text-muted-foreground mb-3">All analytics endpoints accept these optional query parameters to filter results.</p>
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {FILTER_PARAMS.map((p) => (
                <tr key={p.name} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{p.name}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{p.type}</td>
                  <td className="px-3 py-2 text-xs">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <EndpointSection
        testId="endpoint-get-stats"
        method="GET"
        path="/api/analytics/stats"
        description="Returns aggregate statistics: total sessions, total events, completion rate, bounce rate, and average steps per session."
        auth={true}
        responseExample={`{
  "totalSessions": 1920,
  "totalEvents": 10850,
  "completionRate": 21.2,
  "bounceRate": 15.5,
  "avgSteps": 5.3
}`}
      />

      <EndpointSection
        testId="endpoint-get-funnel"
        method="GET"
        path="/api/analytics/funnel"
        description="Returns funnel step data with visitor counts, conversion/drop-off rates, and average time spent per step."
        auth={true}
        responseExample={`{
  "steps": [
    {
      "stepNumber": 1,
      "stepName": "State",
      "uniqueVisitors": 1920,
      "conversionRate": 100,
      "dropOffRate": 0,
      "avgTimeOnStep": 5
    },
    {
      "stepNumber": 2,
      "stepName": "Age",
      "uniqueVisitors": 1650,
      "conversionRate": 85.9,
      "dropOffRate": 14.1,
      "avgTimeOnStep": 9
    }
  ]
}`}
        notes={[
          "avgTimeOnStep is in seconds. Null if no time data recorded for that step.",
        ]}
      />

      <EndpointSection
        testId="endpoint-get-breakdown"
        method="GET"
        path="/api/analytics/breakdown"
        description="Returns the distribution of selected values for each funnel step (e.g., which states or age ranges visitors chose)."
        auth={true}
        responseExample={`[
  {
    "stepNumber": 1,
    "stepName": "State",
    "values": [
      { "value": "California", "count": 245 },
      { "value": "Texas", "count": 198 },
      { "value": "Florida", "count": 172 }
    ]
  }
]`}
      />

      <EndpointSection
        testId="endpoint-get-campaigns"
        method="GET"
        path="/api/analytics/campaigns"
        description="Returns campaign-level performance comparison with sessions, events, and completion rates per UTM campaign."
        auth={true}
        responseExample={`[
  {
    "campaign": "spring-2025",
    "sessions": 580,
    "events": 3200,
    "completionRate": 23.1
  }
]`}
      />

      <EndpointSection
        testId="endpoint-get-devices"
        method="GET"
        path="/api/analytics/devices"
        description="Returns visitor breakdown by device type (mobile, desktop, tablet)."
        auth={true}
        responseExample={`[
  { "deviceType": "mobile", "count": 1150 },
  { "deviceType": "desktop", "count": 620 },
  { "deviceType": "tablet", "count": 150 }
]`}
      />

      <EndpointSection
        testId="endpoint-get-heatmap"
        method="GET"
        path="/api/analytics/heatmap"
        description="Returns session counts grouped by day of week and hour of day for activity pattern analysis."
        auth={true}
        responseExample={`[
  { "day": 0, "hour": 9, "count": 42 },
  { "day": 0, "hour": 10, "count": 58 },
  { "day": 1, "hour": 14, "count": 35 }
]`}
        notes={[
          "day: 0 = Sunday, 6 = Saturday.",
          "hour: 0-23 in UTC.",
        ]}
      />

      <EndpointSection
        testId="endpoint-get-contact-funnel"
        method="GET"
        path="/api/analytics/contact-funnel"
        description="Returns a mini-funnel for the contact form steps (Name, Email, Phone) showing conversion through the form submission process."
        auth={true}
        responseExample={`[
  { "stepName": "Name", "count": 520 },
  { "stepName": "Email", "count": 445 },
  { "stepName": "Phone", "count": 380 }
]`}
      />

      <EndpointSection
        testId="endpoint-get-referrers"
        method="GET"
        path="/api/analytics/referrers"
        description="Returns top referrer URLs ranked by session count."
        auth={true}
        responseExample={`[
  { "referrer": "https://google.com", "count": 850 },
  { "referrer": "https://facebook.com", "count": 320 },
  { "referrer": "(direct)", "count": 280 }
]`}
      />

      <EndpointSection
        testId="endpoint-get-filter-options"
        method="GET"
        path="/api/analytics/filter-options"
        description="Returns the available filter values for the dashboard dropdowns, based on existing data."
        auth={true}
        responseExample={`{
  "pages": ["seniors", "veterans", "first-responders"],
  "pageTypes": ["lead", "call"],
  "domains": ["blueskylife.net", "blueskylife.io"],
  "utmSources": ["google", "facebook", "bing"],
  "utmCampaigns": ["spring-2025", "summer-promo"],
  "utmMediums": ["cpc", "organic", "email"],
  "deviceTypes": ["mobile", "desktop", "tablet"]
}`}
      />

      <EndpointSection
        testId="endpoint-get-export"
        method="GET"
        path="/api/analytics/export"
        description="Downloads raw event data as a CSV file (up to 10,000 most recent events matching filters)."
        auth={true}
        responseExample={`id,session_id,event_type,page,page_type,domain,
step_number,step_name,selected_value,time_on_step,
utm_source,utm_campaign,utm_medium,utm_content,
device_type,os,browser,placement,geo_state,ip_address,
referrer,first_name,last_name,email,phone,event_timestamp
1,"abc-123","step_complete","seniors","lead",
"blueskylife.net",2,"State","Florida",8,"google",
"spring-2025","cpc","hero","mobile","iOS","Safari",
"feed","FL","203.0.113.42","https://google.com",
,,,,,"2025-02-10T12:00:00Z"`}
        notes={[
          "Response Content-Type is text/csv.",
          "Maximum 10,000 rows returned, ordered by most recent first.",
          "PII fields (first_name, last_name, email, phone) are only populated for form_complete events.",
        ]}
      />

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-1" data-testid="text-section-errors">Error Handling</h2>
        <p className="text-sm text-muted-foreground mb-4">Standard error response format.</p>
      </div>

      <Card className="p-5">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Event Ingestion Errors</h4>
            <CodeBlock code={`// 400 Bad Request - Invalid payload
{ "ok": false, "error": "Invalid event data" }

// 403 Forbidden - Origin not allowed
// (No response body, connection closed)

// 500 Internal Server Error
{ "ok": false, "error": "Failed to process event" }`} />
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Analytics Endpoint Errors</h4>
            <CodeBlock code={`// 401 Unauthorized - Not logged in
// (Redirect to login)

// 500 Internal Server Error
{ "message": "Failed to fetch stats" }`} />
          </div>
        </div>
      </Card>

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-1" data-testid="text-section-integration">Integration Example</h2>
        <p className="text-sm text-muted-foreground mb-4">Minimal JavaScript snippet for your landing page.</p>
      </div>

      <Card className="p-5">
        <CodeBlock language="javascript" code={`// Generate a session ID and event helper
const SESSION_ID = crypto.randomUUID();
const params = new URLSearchParams(location.search);

// Detect OS and browser from user agent
function detectOS() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "macOS";
  if (/Win/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}
function detectBrowser() {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV/.test(ua)) return "Facebook";
  if (/Instagram/.test(ua)) return "Instagram";
  if (/Edg/.test(ua)) return "Edge";
  if (/OPR|Opera/.test(ua)) return "Opera";
  if (/Chrome/.test(ua)) return "Chrome";
  if (/Safari/.test(ua)) return "Safari";
  if (/Firefox/.test(ua)) return "Firefox";
  return "Unknown";
}
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? m[2] : undefined;
}
function genEventId() {
  return "evt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 15);
}

// Collect all URL params + cookies once on load
const adParams = {
  utm_source: params.get("utm_source") || undefined,
  utm_medium: params.get("utm_medium") || undefined,
  utm_campaign: params.get("utm_campaign") || undefined,
  utm_content: params.get("utm_content") || undefined,
  utm_term: params.get("utm_term") || undefined,
  utm_id: params.get("utm_id") || undefined,
  placement: params.get("placement") || undefined,
  media_type: params.get("media_type") || undefined,
  campaign_name: params.get("campaign_name") || undefined,
  campaign_id: params.get("campaign_id") || undefined,
  ad_name: params.get("ad_name") || undefined,
  ad_id: params.get("ad_id") || undefined,
  adset_name: params.get("adset_name") || undefined,
  adset_id: params.get("adset_id") || undefined,
  fbclid: params.get("fbclid") || undefined,
  fbc: getCookie("_fbc") || undefined,
  fbp: getCookie("_fbp") || undefined,
  external_id: params.get("external_id") || undefined,
};

// Accumulate quiz answers as the user progresses
const quizAnswers = {};

// Helper to send a tracking event
async function trackEvent(data) {
  await fetch("https://trackingjunction.com/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      ...adParams,
      session_id: SESSION_ID,
      event_id: genEventId(),
      page: params.get("angle") || "seniors",
      page_type: "lead",
      domain: location.hostname,
      device_type: /Mobi/i.test(navigator.userAgent)
        ? "mobile" : /Tablet|iPad/i.test(navigator.userAgent)
        ? "tablet" : "desktop",
      os: detectOS(),
      browser: detectBrowser(),
      user_agent: navigator.userAgent,
      referrer: document.referrer || undefined,
      page_url: location.href,
      screen_resolution: screen.width + "x" + screen.height,
      viewport: window.innerWidth + "x" + window.innerHeight,
      language: navigator.language || "Unknown",
      quiz_answers: { ...quizAnswers },
    }),
  });
}

// Track page landing
trackEvent({ step_number: 0, step_name: "Landing",
  event_type: "page_land" });

// Track quiz step completion with timing
let stepStart = Date.now();
function onStepComplete(stepNum, stepName, selectedValue) {
  const timeOnStep = Math.round((Date.now() - stepStart) / 1000);
  quizAnswers[stepName.toLowerCase()] = selectedValue;
  trackEvent({
    step_number: stepNum,
    step_name: stepName,
    selected_value: selectedValue,
    event_type: "step_complete",
    time_on_step: Math.min(timeOnStep, 3600),
  });
  stepStart = Date.now();
}

// Track form submission (final step) with PII
function onFormComplete(formData) {
  const timeOnStep = Math.round((Date.now() - stepStart) / 1000);
  trackEvent({
    step_number: 8, step_name: "Phone",
    event_type: "form_complete",
    time_on_step: Math.min(timeOnStep, 3600),
    first_name: formData.firstName,
    last_name: formData.lastName,
    email: formData.email,
    phone: formData.phone,
  });
}`} />
      </Card>

      <div className="h-12" />
    </div>
  );
}
