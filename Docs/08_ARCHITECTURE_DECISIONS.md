# AgriBridge — Architecture Decisions

**Status:** Accepted initial implementation baseline  
**Date:** 2026-11-14

This document records implementation choices for the first web application foundation. Product behaviours marked PENDING in the product specifications remain pending; this document does not approve them.

## ADR-001 — Frontend application

**Decision:** React with TypeScript, built with Vite.

**Reasoning:** A client-rendered single-page application is suitable for the initial browser-based product, has a mature ecosystem, and can be deployed as static assets without a continuously running application server.

**Build output:** `dist/`  
**Build command:** `npm run build`

## ADR-002 — Backend platform

**Decision:** Supabase is the selected backend platform for the initial implementation.

Planned responsibilities:
- PostgreSQL database.
- Supabase Auth.
- Supabase Storage.
- Row Level Security (RLS).
- Supabase Edge Functions for privileged server-side operations and external API calls.

The application must remain in a safe unconfigured state until project credentials are supplied. No privileged key may be exposed in browser code.

## ADR-003 — Hosting and source control

**Decision:** GitHub is the source of truth. Cloudflare Pages is the planned frontend host, connected to the GitHub repository.

- Production branch: `main`.
- Build command: `npm run build`.
- Build output directory: `dist`.
- SPA navigation must fall back to `index.html`.

Hosting configuration and deployment secrets will be configured in the hosting dashboard, not committed to the repository.

## ADR-004 — AI provider boundary

**Decision:** AI capabilities will be called only through server-side functions. Provider credentials must never be placed in Vite `VITE_*` variables or shipped to the browser.

The first provider/model is not locked by this decision. Provider choice, evaluation, costs, privacy and supported use cases require a separate approval.

## ADR-005 — Initial engineering dependencies

- React Router for client-side routing.
- Supabase JavaScript client for browser-safe Supabase access.
- Zod for runtime validation at application boundaries.
- Lucide React for interface icons.
- ESLint and TypeScript strict mode for static checks.

Tailwind and shadcn/ui are deferred until the initial design system and component needs justify adding them. The first interface uses scoped global CSS to keep the initial build straightforward.

## Security constraints

1. Client-side checks are not authorization.
2. Every protected database table must have reviewed RLS policies before user data is stored.
3. Never expose Supabase service-role credentials in the frontend.
4. AI, payment, and other privileged provider keys belong in server-side secrets.
5. Validate untrusted input on the server, even when client-side validation exists.
6. Private uploads must not be stored in publicly readable buckets by default.
7. Do not claim AI estimates are certified quality grades.
8. Do not implement escrow, wallet, payment collection, or payouts without approved requirements.

## Deployment compatibility

The frontend is a static Vite SPA. Do not introduce a dependency on SSR, a persistent Node server, or a Python server unless a new architecture decision explicitly approves it.

Before adding a dependency or service, verify compatibility with React, Vite, Cloudflare Pages, Supabase and the project's cost constraints.
