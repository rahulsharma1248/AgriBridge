## 10. Mandatory Frontend Deployment Architecture

AgriBridge must initially be developed as a client-rendered React single-page application using Vite.

The production build must generate static HTML, CSS and JavaScript assets.

The application must be deployable directly to Cloudflare Pages without requiring a continuously running Node.js or Python server.

Deployment configuration must include:
- GitHub-connected automatic deployments.
- Production and preview environments.
- Correct build command: npm run build.
- Build output directory: dist.
- SPA routing fallback for client-side routes.
- Secure environment-variable configuration.
- Proper separation of development and production credentials.

Do not introduce mandatory server-side rendering or dependencies on Node.js server hosting.

Use Supabase Edge Functions for secure backend operations and AI integrations.

All application functionality must be designed to work with the selected deployment architecture.

Future SSR requirements may be supported through Cloudflare Workers without requiring a complete application rewrite.

## 11. Deployment Compatibility Rule

Before introducing any new framework, library or infrastructure dependency, verify that it is compatible with:

1. React and Vite.
2. Cloudflare Pages deployment.
3. Supabase backend services.
4. The free-tier development and deployment strategy.

Do not introduce dependencies that require paid infrastructure for basic application functionality without explicit approval.
