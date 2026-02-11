# TrackingJunction - Landing Page Analytics Dashboard

## Overview
Web analytics dashboard for tracking user interactions on landing pages (blueskylife.net and blueskylife.io). Receives anonymous tracking events from external landing pages and displays aggregated analytics.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI + Recharts
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Auth**: Replit Auth (OpenID Connect)
- **Routing**: wouter (frontend), Express (backend)

## Key Files
- `shared/schema.ts` - Data models (trackingEvents table, validation schemas, step definitions)
- `shared/models/auth.ts` - Auth models (users, sessions tables)
- `server/routes.ts` - API routes (event ingestion + analytics endpoints)
- `server/storage.ts` - Database operations (event insert, stats, funnel, breakdown, drilldown queries)
- `server/db.ts` - Database connection
- `client/src/pages/dashboard.tsx` - Main dashboard page
- `client/src/pages/reports.tsx` - Funnel reports with drilldown + event logs
- `client/src/pages/api-docs.tsx` - API documentation page
- `client/src/pages/server-logs.tsx` - Stape-style server logs dashboard
- `client/src/pages/block-list.tsx` - Block List management page
- `client/src/pages/landing.tsx` - Landing/login page
- `client/src/components/` - Dashboard components (filters, funnel chart, funnel table, step breakdown, stats cards, campaign table, device breakdown, time heatmap, contact funnel, referrer breakdown, csv export)

## API Endpoints
- `POST /api/events` - Receive tracking events (CORS enabled for blueskylife.net/.io)
- `GET /api/analytics/stats` - Aggregate stats including bounce rate (protected)
- `GET /api/analytics/funnel` - Funnel data with avg time-on-step (protected)
- `GET /api/analytics/breakdown` - Step option breakdowns (protected)
- `GET /api/analytics/drilldown` - Drilldown report with page_land/form_complete counts (protected)
- `GET /api/analytics/campaigns` - Campaign comparison (protected)
- `GET /api/analytics/devices` - Device breakdown (protected)
- `GET /api/analytics/heatmap` - Time-of-day heatmap (protected)
- `GET /api/analytics/contact-funnel` - Contact form mini-funnel (protected)
- `GET /api/analytics/referrers` - Top referrers (protected)
- `GET /api/analytics/filter-options` - Dynamic filter options (protected)
- `GET /api/analytics/logs` - Paginated event logs with search (protected)
- `GET /api/analytics/export` - CSV export up to 10,000 events (protected)
- `DELETE /api/analytics/events/:id` - Delete single event (protected)
- `DELETE /api/analytics/events/session/:sessionId` - Delete session events (protected)
- `DELETE /api/analytics/all-events` - Delete all events (protected)
- `GET /api/server-logs` - Paginated server request logs with filters (protected)
- `DELETE /api/server-logs` - Clear all server logs (protected)
- `DELETE /api/analytics/events/sessions` - Bulk delete multiple sessions (protected, body: {sessionIds: string[]})
- `GET /api/retell/calls?phone=...` - Search Retell call history by phone number (protected)
- `GET /api/retell/recording/:callId` - Get Retell call recording/transcript (protected)
- `GET /api/retell/blocked` - List blocked phone numbers (protected)
- `POST /api/retell/block` - Block a phone number (protected, body: {phone, reason?})
- `POST /api/retell/bulk-unblock` - Bulk unblock phone numbers (protected, body: {phones: string[]})
- `DELETE /api/retell/block/:phone` - Unblock a phone number (protected)
- Auth routes: `/api/login`, `/api/logout`, `/api/auth/user`

## Event Schema Fields
### Core Fields
- `page` - Audience name: "seniors", "veterans", or "first-responders"
- `pageType` - Funnel type: "lead" or "call"
- `domain` - "blueskylife.net" or "blueskylife.io"
- `stepNumber` / `stepName` - Funnel step info (step 0 = Landing/page_land)
- `selectedValue` - The option the visitor selected at each step
- `timeOnStep` - Seconds spent on each step before clicking (integer, 0-3600)
- `eventType` - "page_land", "step_complete", or "form_complete"
- `sessionId` - UUID per visitor session
- `eventId` - Unique ID per event (different from externalId)

### UTM & Ad Fields
- `utmSource`, `utmCampaign`, `utmMedium`, `utmContent`, `utmTerm`, `utmId`
- `mediaType` - Media type (e.g., "facebook")
- `campaignName` / `campaignId` - Facebook campaign name and ID
- `adName` / `adId` - Facebook ad name and ID
- `adsetName` / `adsetId` - Facebook adset name and ID
- `placement` - Facebook ad placement (e.g., "Facebook_Mobile_Feed")

### Device & Visitor Fields
- `deviceType` - "mobile", "desktop", or "tablet"
- `os` - Operating system (Windows, macOS, iOS, Android, Linux, ChromeOS, Unknown)
- `browser` - Browser name (Chrome, Safari, Firefox, Edge, Opera, Facebook, Instagram, Unknown)
- `geoState` - 2-letter state code from geo-IP (optional)
- `ipAddress` - Visitor IP address (optional)
- `userAgent` - Full user agent string
- `referrer` - Full referrer URL

### Facebook Tracking Fields
- `fbclid` - Facebook click ID
- `fbc` - Facebook _fbc cookie value
- `fbp` - Facebook _fbp cookie value
- `externalId` - External ID per session (raw, not hashed)

### Quiz & PII Fields
- `quizAnswers` - JSON object of accumulated quiz answers (e.g., {"state": "Florida", "age": "66-70"})
- PII fields (form_complete only): `firstName`, `lastName`, `email`, `phone`

## Event Flow Per Session
1. `page_land` (step 0, "Landing") - fires once on page load
2. `step_complete` (steps 1-7 for lead, 1-5 for call) - fires after each quiz answer
3. `form_complete` (step 8 for lead) - fires on final form submission with lead PII

## Quiz Step Definitions
- **Lead-gen**: Landing(0) > Beneficiary(1) > State(2) > Budget(3) > Age(4) > Income(5) > Name(6) > Email(7) > Phone(8)
- **Call-in**: Landing(0) > State(1) > Age(2) > Income(3) > Budget(4) > Purpose(5) > Call CTA(6)

## Reports Page Features
- Funnel summary with horizontal step layout: Lands | S1 # / CVR / Land CVR | S2 ... | Form Complete
- Drilldown report up to 3 levels deep by: Domain, Device Type, Audience, UTM Source/Campaign/Medium
- Compact text (10-11px) in drilldown tables for horizontal readability
- Event logs with search, pagination, delete individual/session/all
- Event log detail view shows all fields including Facebook ad params, quiz answers, and PII (form_complete only)
- Filters: domain, device type, audience, UTM source/campaign/medium, date range
- Refresh controls: manual refresh, auto-refresh (30s/1m/5m/Off)

## Dashboard Features
- Stats cards (Total Sessions, Total Events, Conversion Rate, Bounce Rate, Avg Steps)
- Funnel chart + funnel table with avg time-on-step (highlights slow steps)
- Campaign performance comparison table
- Device breakdown chart
- Activity heatmap (sessions by day/hour)
- Contact form mini-funnel (Name > Email > Phone)
- Top referrers table
- Step breakdown with selected value distributions
- CSV export (includes all fields)

## Database
- PostgreSQL with Drizzle ORM
- Tables: tracking_events, users, sessions, blocked_numbers
- Indexed on session_id, page/page_type, domain, timestamp, step, event_type, utm_campaign, device_type

## Retell AI Integration
- Uses `retell_api_key` secret for API authentication
- Proxies Retell API v2 calls through backend (never exposes key to frontend)
- Matches calls by phone number from form_complete events
- Features: play recording, download .wav, view transcript, call summary/sentiment, block/unblock numbers
- Local blocked_numbers table for phone number blocking (Retell doesn't have per-number block API)
