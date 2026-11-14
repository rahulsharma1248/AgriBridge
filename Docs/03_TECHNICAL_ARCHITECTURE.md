# AgriBridge — Technical Architecture

**Document status:** Architecture decision record in progress  
**Purpose:** Define the system boundaries and decisions required before implementation.

## 1. Architecture goals

The system should be:
- Secure by default.
- Maintainable by a small development team.
- Suitable for iterative delivery.
- Testable at unit, integration, and end-to-end levels.
- Able to support role-based workflows.
- Observable and diagnosable in production.
- Cost-conscious during early development.
- Capable of integrating external data and AI services without tightly coupling the core application to one provider.

## 2. Proposed logical components

These are logical responsibilities, not a final framework or deployment choice.

### 2.1 Web client
Responsible for:
- User interface and navigation.
- Role-aware views.
- Form input and client-side validation for usability.
- Displaying offers, requirements, comparisons, conversations, and logistics status.
- Calling authorized backend interfaces.

The client must not contain privileged secrets or be trusted to enforce authorization by itself.

### 2.2 Application/backend layer
Responsible for:
- Authentication integration and authorization checks.
- Business rules and state transitions.
- Validation of all untrusted input.
- Offer, requirement, enquiry, negotiation, and logistics workflows.
- Controlled access to external providers.
- Audit events and notification orchestration.

### 2.3 Database and file storage
Responsible for:
- Persistent structured application data.
- Referential integrity and constraints.
- Role- and resource-level access controls.
- Secure storage of uploaded images/documents.
- Backup and retention strategy.

### 2.4 External integrations
Potential integrations include:
- AI model provider.
- Maps/geocoding/routing provider.
- Market/price data sources.
- Messaging or notification provider.
- Payment provider, only if an approved payment model requires it.

Every integration needs a documented purpose, data exchanged, credentials, cost, failure behaviour, and provider terms review.

## 3. Technology selection

No stack is approved solely by this document.

A previously discussed candidate stack was:
- Next.js / React with TypeScript for the web application.
- Supabase for managed PostgreSQL, authentication, and storage.
- An external AI API such as Gemini for selected AI features.
- GitHub for version control and collaboration.
- Vercel or another suitable host for deployment.

These are **candidates, not final decisions**. Before creating the production project, compare suitability, pricing, free-tier limits, security model, regional availability, vendor lock-in, and operational complexity. Record the approved choices in `docs/08_ARCHITECTURE_DECISIONS.md` or an equivalent decision log.

## 4. Logical data and request flow

Typical request flow:

1. User interacts with the web client.
2. Client sends a request to an approved backend/API boundary.
3. Backend authenticates the session.
4. Backend authorizes the action against the user's role and resource ownership.
5. Backend validates input and applies business rules.
6. Database transaction persists the change.
7. Any required external integration is invoked through a controlled server-side boundary.
8. The client receives a safe response.
9. Important state changes are logged and relevant notifications are queued or sent.

Do not rely on client-side role checks as a security boundary.

## 5. Suggested domain boundaries

Keep domain logic separated around concepts such as:
- Identity and profiles.
- Seller offers / produce lots.
- Buyer requirements.
- Discovery and matching.
- Enquiries and negotiation.
- Price and cost comparisons.
- Logistics requests and jobs.
- Notifications.
- Reports, support, and administration.

These are conceptual boundaries. The final code structure should follow the approved stack and avoid unnecessary microservices at an early stage.

## 6. API design principles

- Use consistent resource naming and response formats.
- Validate request bodies, query parameters, and uploaded files.
- Apply authorization on every protected operation.
- Use pagination for potentially large result sets.
- Add rate limiting to sensitive or abuse-prone endpoints.
- Avoid exposing internal database errors.
- Use idempotency where retries could duplicate consequential actions.
- Version APIs when compatibility requires it.
- Document endpoints and error codes.

## 7. Background processing

Consider background jobs for tasks that do not need to block a user request, such as:
- Image analysis.
- Notifications.
- Scheduled expiry of offers.
- External data refresh.
- File processing.

**PENDING:** Queue/job provider, retry policy, dead-letter handling, timeout limits, and cost constraints.

## 8. AI integration architecture

- Call AI providers from a server-side boundary.
- Keep provider keys out of browser bundles and source control.
- Validate file type, size, and ownership before processing.
- Minimize personal or commercially sensitive data sent to providers.
- Record model/provider and relevant processing metadata where appropriate.
- Handle provider timeouts, rate limits, and malformed outputs.
- Treat model output as untrusted data; validate before display or persistence.
- Provide a non-AI fallback where practical.
- Do not let an AI model authorize payments, approve users, or make binding quality determinations.

## 9. File and image handling

Define:
- Allowed formats and maximum file sizes.
- Image resizing/compression policy.
- Private versus public access.
- Signed URL or equivalent access approach.
- Malware/content validation where appropriate.
- Retention and deletion policy.
- Ownership checks and authorization.

Do not place private user uploads in a publicly readable bucket by default.

## 10. Environments and configuration

Maintain separate development, test/staging, and production configuration where feasible.

- Keep secrets in the hosting provider's secret manager or environment configuration.
- Commit an `.env.example` containing names and safe placeholders only.
- Never commit real `.env` files or credentials.
- Document required variables and rotation procedures.
- Avoid using production user data for local development.

## 11. Reliability and observability

Plan for:
- Structured server logs without secrets.
- Error monitoring.
- Health checks.
- Database backups and restore testing.
- Monitoring of external provider failures.
- Request timeouts and bounded retries.
- Graceful degraded states when optional services fail.

## 12. Deployment model

The repository is the source of truth. Deployment should build from a controlled branch and run checks before release.

The deployed web application must not expose repository documentation, environment files, tests, or server-only code as public static assets. Verify build output and hosting configuration.

## 13. Architecture decisions still required

1. Approved frontend framework and language.
2. Backend/API approach.
3. Database provider and schema migration approach.
4. Authentication provider and session strategy.
5. File storage provider and access policy.
6. AI provider(s) and model selection.
7. Maps/geolocation provider.
8. Market/price data sources.
9. Notification channels.
10. Hosting, domains, and deployment environments.
11. Logging, monitoring, backups, and recovery.
12. Expected scale, performance targets, and budget.

## 14. Architecture change rule

Any consequential change must be recorded with:
- Decision title and date.
- Context/problem.
- Options considered.
- Decision and rationale.
- Security, cost, and migration impact.
- Status: proposed, accepted, superseded, or rejected.
