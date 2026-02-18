# TrackingJunction - Landing Page Analytics Dashboard

## Overview
TrackingJunction is a web analytics dashboard designed to monitor and analyze user interactions on specific landing pages (blueskylife.net and blueskylife.io). It anonymously collects tracking events and presents them as aggregated analytics. The platform aims to provide comprehensive insights into user behavior, funnel performance, and campaign effectiveness, enabling data-driven optimization of marketing efforts. Its core purpose is to transform raw interaction data into actionable intelligence for improved conversion rates and user experience.

## User Preferences
I prefer clear, concise communication and detailed explanations when necessary. I value an iterative development process. Before making significant architectural changes or adding new external dependencies, please ask for my approval. Ensure code is well-documented and follows modern JavaScript/TypeScript best practices.

## System Architecture
The application features a modern full-stack architecture. The **frontend** is built with React, TypeScript, Tailwind CSS, Shadcn UI for components, and Recharts for data visualization. The **backend** is powered by Express.js and interacts with a PostgreSQL database using Drizzle ORM. Authentication is handled via Replit Auth (OpenID Connect). Routing is managed by `wouter` on the frontend and Express on the backend.

Key architectural decisions include:
- **Data Models:** Centralized schema definition (`shared/schema.ts`) for tracking events, validation, and step definitions, ensuring consistency across frontend and backend.
- **Modular Backend Services:** Separation of concerns with dedicated modules for API routes (`server/routes.ts`), database operations (`server/storage.ts`), and external API clients (e.g., `server/facebook.ts`, `server/meta-conversions.ts`).
- **Dynamic Reporting:** Implementation of flexible reporting features including funnel summaries, multi-level drilldown reports, and audience-aware step columns to handle varied user journeys.
- **Real-time Analytics:** Dashboard components are designed to provide up-to-date statistics, funnel visualizations, campaign comparisons, and activity heatmaps.
- **Robust Event Tracking:** A comprehensive event schema captures detailed user interaction data, including core event details, UTM parameters, ad campaign data, device information, geographic data, and Facebook tracking identifiers.
- **Lead Scoring Engine:** An integrated engine (`server/lead-scoring.ts`) capable of parsing budget, estimating annual premiums, and classifying customer tiers based on defined rules.
- **Bot Detection & Filtering:** Automated bot detection (`server/bot-detection.ts`) flags known bot user agents, missing/empty user agents, short user agents, and sessions with insufficient browser fingerprints (missing screen resolution, viewport, language, browser, OS). Events are tagged with `isBot` and `botReason` at ingest time. Bots are excluded by default in analytics. Retroactive rescanning and bulk purging of bot traffic are available via API endpoints.
- **User Access Control:** Role-based access management with an `allowed_users` table controlling who can access the dashboard. Only emails on the allowed list (with `active=true`) can access protected routes. Admins (role='admin' in allowed_users) can manage the access list via `/users` page. The `isAuthenticated` middleware checks the allowed list on every request, and `isAdmin` verifies admin role from allowed_users. Self-modification protections prevent admins from removing their own access.

## External Dependencies
- **PostgreSQL:** Primary database for storing tracking events, user data, sessions, and blocked numbers.
- **Replit Auth:** Used for user authentication and session management based on OpenID Connect.
- **Meta Marketing API (Facebook Ads API):** Integrates with Facebook's API (v24.0) to fetch ad account details, campaign insights, ad set insights, and ad-level performance metrics. Requires specific system user access and scopes (`ads_read`, `business_management`).
- **Meta Conversions API (CAPI):** Used for uploading server-side conversion events to Facebook, detecting missing conversions, and managing custom audience signals. Handles PII hashing and event formatting.
- **Retell AI API:** Utilized for AI-powered call analysis, including accessing call recordings, transcripts, summaries, and sentiment analysis. The API key is securely managed on the backend.