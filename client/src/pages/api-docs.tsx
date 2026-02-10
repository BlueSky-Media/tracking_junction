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
  "page": "seniors",
  "page_type": "lead",
  "domain": "blueskylife.net",
  "step_number": 2,
  "step_name": "Age",
  "selected_value": "66-70",
  "session_id": "a50e8400-e29b-41d4-a716-446655440001",
  "event_type": "step_complete",
  "time_on_step": 8,
  "utm_source": "google",
  "utm_campaign": "spring-2025",
  "utm_medium": "cpc",
  "utm_content": "hero-banner",
  "device_type": "mobile",
  "referrer": "https://google.com/search?q=..."
}`}
        responseExample={`{ "ok": true }`}
        notes={[
          'CORS is restricted to origins: blueskylife.net and blueskylife.io (with/without www prefix).',
          'page: Audience name -- "seniors", "veterans", or "first-responders".',
          'page_type: "lead" for lead-gen funnels (9 steps) or "call" for call-in funnels (6 steps).',
          'event_type: "page_land" when visitor first arrives, "step_complete" after each quiz answer, "form_complete" for final submission.',
          'time_on_step: Seconds (0-3600) the visitor spent on this step before clicking. Optional.',
          'session_id: A UUID v4 generated client-side per visitor session.',
          'selected_value: The option the visitor chose at this step (e.g., "California", "66-70").',
          'UTM fields, device_type, and referrer are all optional.',
        ]}
      />

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-1" data-testid="text-section-event-schema">Event Schema Reference</h2>
        <p className="text-sm text-muted-foreground mb-4">Complete field reference for the event payload.</p>
      </div>

      <Card className="p-5">
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium">Field</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Required</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { field: "page", type: "string", required: "Yes", desc: 'Audience: "seniors", "veterans", or "first-responders"' },
                { field: "page_type", type: "string", required: "Yes", desc: '"lead" or "call"' },
                { field: "domain", type: "string", required: "Yes", desc: '"blueskylife.net" or "blueskylife.io"' },
                { field: "step_number", type: "integer", required: "Yes", desc: "Step index (0-20)" },
                { field: "step_name", type: "string", required: "Yes", desc: 'Step label (e.g., "State", "Age", "Email")' },
                { field: "selected_value", type: "string", required: "No", desc: "Visitor's choice at this step" },
                { field: "session_id", type: "string (UUID)", required: "Yes", desc: "UUID v4 per visitor session" },
                { field: "event_type", type: "string", required: "No", desc: '"page_land", "step_complete", or "form_complete". Defaults to "step_complete"' },
                { field: "time_on_step", type: "integer", required: "No", desc: "Seconds spent on step (0-3600)" },
                { field: "timestamp", type: "string (ISO)", required: "No", desc: "Event timestamp. Defaults to server receive time" },
                { field: "user_agent", type: "string", required: "No", desc: "Browser user agent. Auto-detected if omitted" },
                { field: "utm_source", type: "string", required: "No", desc: "UTM source parameter" },
                { field: "utm_campaign", type: "string", required: "No", desc: "UTM campaign parameter" },
                { field: "utm_medium", type: "string", required: "No", desc: "UTM medium parameter" },
                { field: "utm_content", type: "string", required: "No", desc: "UTM content parameter" },
                { field: "device_type", type: "string", required: "No", desc: '"mobile", "desktop", or "tablet"' },
                { field: "referrer", type: "string", required: "No", desc: "Full referrer URL" },
              ].map((row) => (
                <tr key={row.field} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{row.field}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{row.type}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.required === "Yes" ? (
                      <Badge variant="default" className="text-xs">Required</Badge>
                    ) : (
                      <span className="text-muted-foreground">Optional</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.desc}</td>
                </tr>
              ))}
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
            <Badge variant="secondary" className="text-xs">9 steps</Badge>
          </h3>
          <ol className="space-y-1.5 text-sm">
            {[
              { n: 1, name: "State" },
              { n: 2, name: "Age" },
              { n: 3, name: "Income" },
              { n: 4, name: "Budget" },
              { n: 5, name: "Beneficiary" },
              { n: 6, name: "Name" },
              { n: 7, name: "Email" },
              { n: 8, name: "Phone" },
              { n: 9, name: "Thank You" },
            ].map((s) => (
              <li key={s.n} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0">{s.n}</span>
                <span>{s.name}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            Call-In Funnel
            <Badge variant="secondary" className="text-xs">6 steps</Badge>
          </h3>
          <ol className="space-y-1.5 text-sm">
            {[
              { n: 1, name: "State" },
              { n: 2, name: "Age" },
              { n: 3, name: "Income" },
              { n: 4, name: "Budget" },
              { n: 5, name: "Purpose" },
              { n: 6, name: "Call CTA" },
            ].map((s) => (
              <li key={s.n} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0">{s.n}</span>
                <span>{s.name}</span>
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
device_type,referrer,event_timestamp
1,"abc-123","step_complete","seniors","lead",
"blueskylife.net",2,"Age","66-70",8,"google",
"spring-2025","cpc","hero","mobile",
"https://google.com","2025-02-10T12:00:00Z"`}
        notes={[
          "Response Content-Type is text/csv.",
          "Maximum 10,000 rows returned, ordered by most recent first.",
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
        <CodeBlock language="javascript" code={`// Generate a session ID once per visitor
const SESSION_ID = crypto.randomUUID();

// Helper to send a tracking event
async function trackEvent(data) {
  await fetch("https://trackingjunction.com/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      session_id: SESSION_ID,
      page: "seniors",           // audience
      page_type: "lead",         // funnel type
      domain: "blueskylife.net",
      device_type: /Mobi/i.test(navigator.userAgent)
        ? "mobile" : "desktop",
      referrer: document.referrer || undefined,
      // Include UTM params from URL
      ...Object.fromEntries(
        ["utm_source","utm_campaign","utm_medium","utm_content"]
          .map(k => [k, new URLSearchParams(location.search).get(k)])
          .filter(([,v]) => v)
      ),
    }),
  });
}

// Track page landing
trackEvent({
  step_number: 0,
  step_name: "Landing",
  event_type: "page_land",
});

// Track quiz step completion with timing
let stepStart = Date.now();
function onStepComplete(stepNumber, stepName, selectedValue) {
  const timeOnStep = Math.round((Date.now() - stepStart) / 1000);
  trackEvent({
    step_number: stepNumber,
    step_name: stepName,
    selected_value: selectedValue,
    event_type: "step_complete",
    time_on_step: Math.min(timeOnStep, 3600),
  });
  stepStart = Date.now(); // reset for next step
}`} />
      </Card>

      <div className="h-12" />
    </div>
  );
}
