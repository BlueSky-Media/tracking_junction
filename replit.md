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
- `server/storage.ts` - Database operations (event insert, stats, funnel, breakdown queries)
- `server/seed.ts` - Seed data generation with realistic timeOnStep values
- `server/db.ts` - Database connection
- `client/src/pages/dashboard.tsx` - Main dashboard page
- `client/src/pages/landing.tsx` - Landing/login page
- `client/src/components/` - Dashboard components (filters, funnel chart, funnel table, step breakdown, stats cards, campaign table, device breakdown, time heatmap, contact funnel, referrer breakdown, csv export)

## API Endpoints
- `POST /api/events` - Receive tracking events (CORS enabled for blueskylife.net/.io)
- `GET /api/analytics/stats` - Aggregate stats including bounce rate (protected)
- `GET /api/analytics/funnel` - Funnel data with avg time-on-step (protected)
- `GET /api/analytics/breakdown` - Step option breakdowns (protected)
- `GET /api/analytics/campaigns` - Campaign comparison (protected)
- `GET /api/analytics/devices` - Device breakdown (protected)
- `GET /api/analytics/heatmap` - Time-of-day heatmap (protected)
- `GET /api/analytics/contact-funnel` - Contact form mini-funnel (protected)
- `GET /api/analytics/referrers` - Top referrers (protected)
- `GET /api/analytics/filter-options` - Dynamic filter options (protected)
- `GET /api/analytics/export` - CSV export up to 10,000 events (protected)
- Auth routes: `/api/login`, `/api/logout`, `/api/auth/user`

## Event Schema Fields
- `page` - Audience name: "seniors", "veterans", or "first-responders"
- `pageType` - Funnel type: "lead" or "call"
- `domain` - "blueskylife.net" or "blueskylife.io"
- `stepNumber` / `stepName` - Funnel step info
- `selectedValue` - The option the visitor selected at each step
- `timeOnStep` - Seconds spent on each step before clicking (integer, 0-3600)
- `eventType` - "page_land", "step_complete", or "form_complete"
- `sessionId` - UUID per visitor session
- UTM fields: `utmSource`, `utmCampaign`, `utmMedium`, `utmContent`
- `deviceType` - "mobile", "desktop", or "tablet"
- `referrer` - Full referrer URL

## Quiz Step Definitions
- **Lead-gen**: State > Age > Income > Budget > Beneficiary > Name > Email > Phone > Thank You
- **Call-in**: State > Age > Income > Budget > Purpose > Call CTA

## Dashboard Features
- Stats cards (Total Sessions, Total Events, Conversion Rate, Bounce Rate, Avg Steps)
- Funnel chart + funnel table with avg time-on-step (highlights slow steps)
- Campaign performance comparison table
- Device breakdown chart
- Activity heatmap (sessions by day/hour)
- Contact form mini-funnel (Name > Email > Phone)
- Top referrers table
- Step breakdown with selected value distributions
- CSV export
- Filters: audience (page), funnel type, domain, date range, UTM source/campaign/medium, device type

## Database
- PostgreSQL with Drizzle ORM
- Tables: tracking_events, users, sessions
- Indexed on session_id, page/page_type, domain, timestamp, step, event_type, utm_campaign, device_type
