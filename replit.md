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
- `server/seed.ts` - Seed data generation
- `server/db.ts` - Database connection
- `client/src/pages/dashboard.tsx` - Main dashboard page
- `client/src/pages/landing.tsx` - Landing/login page
- `client/src/components/` - Dashboard components (filters, funnel chart, funnel table, step breakdown, stats cards)

## API Endpoints
- `POST /api/events` - Receive tracking events (CORS enabled for blueskylife.net/.io)
- `GET /api/analytics/stats` - Aggregate stats (protected)
- `GET /api/analytics/funnel` - Funnel data (protected)
- `GET /api/analytics/breakdown` - Step option breakdowns (protected)
- Auth routes: `/api/login`, `/api/logout`, `/api/auth/user`

## Quiz Step Definitions
- **Lead-gen**: State > Age > Income > Budget > Beneficiary > Name > Email > Phone > Thank You
- **Call-in**: State > Age > Income > Budget > Purpose > Call CTA

## Database
- PostgreSQL with Drizzle ORM
- Tables: tracking_events, users, sessions
- Indexed on session_id, page/page_type, domain, timestamp
