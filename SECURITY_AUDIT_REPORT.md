# Comprehensive Technical Security Audit

Date: 2026-02-20
Scope: Full application (frontend, Supabase edge functions, SQL/RLS policies, infra-visible code)

## Executive Summary

This system currently has **critical trust-boundary failures** in backend edge functions and multi-tenant data isolation. The most severe issue pattern is:

1. Edge functions execute with service-role privileges.
2. Caller identity/tenant is often taken from request body (`user_id`, `organization_id`, `branch_id`) rather than from verified JWT claims.
3. CORS is broadly open (`*`) on privileged endpoints.

Combined, this creates realistic paths for cross-tenant data read/write, privilege escalation, and payment/order tampering.

---

## 1) Architecture Review

### Architectural Risk List

#### High
- **Service-role BFF without identity binding**: Multiple edge functions use service role and trust caller-provided identity fields.
- **Weak tenant boundary design**: Tenant/branch selection often happens in client payload, not server-verified claims.
- **Frontend role checks mistaken as security controls**: Route guards are present but backend authorization is inconsistent.

#### Medium
- **Over-broad query patterns**: Some frontend data fetches pull broad sets (e.g., all active branches) and rely on DB policies to save correctness.
- **AI orchestration function directly accesses tenant-sensitive context with caller-supplied org/branch IDs.**

#### Low
- **Layering inconsistencies**: UI/BFF/DB responsibilities are blurred in places (stock lock + order persistence + auth assumptions in one handler).

### Refactoring Recommendations
- Introduce a **strict Backend-for-Frontend gateway contract**:
  - Derive `user_id`, `organization_id`, `role` from validated JWT (`Authorization` header), never request body.
  - Enforce tenant/branch membership in a single shared guard module.
- Move authz logic to centralized helpers for all edge functions (`requireAuth`, `requireRole`, `requireBranchAccess`).
- Convert edge function security model from "service role + manual checks" to:
  - authenticated user client for normal reads/writes + RLS, or
  - service role only after verified claim extraction and explicit tenant checks.

### Scalability Risks
- No visible API-level rate limiting for public/edge entry points.
- Chat/AI + context fetch pipeline has no abuse controls and can amplify DB/API load.
- Redis inventory pipeline + SQL operations are not wrapped in distributed transaction semantics; rollback is best-effort only.

### Tenant Isolation Risks
- Policies and function flows allow tenant context to be caller-influenced.
- Several role/data checks are performed using caller-submitted `user_id` (spoofable).

---

## 2) Authentication & Authorization

### Auth Vulnerabilities
- **Spoofable identity in privileged endpoints** (`manage-menu`, `manage-staff`, `manage-inventory`): `user_id` is taken from request JSON and used for auth checks.
- **Open CORS on privileged functions** broadens attack surface from browser contexts.
- **Hardcoded anonymous key/client bootstrap in frontend** encourages static credential sprawl.

### Broken Access Control Risks
- **Horizontal/tenant escalation**: attacker submits another user's `user_id` from target org.
- **Vertical escalation**: attacker uses owner/admin `user_id` and performs privileged actions.
- **Backend enforcement gap**: frontend protected routes are bypassable by direct API invocation.

### Missing Backend Enforcement
- No uniform JWT verification path before business actions in multiple edge functions.
- No consistent check that `branch_id` belongs to authenticated principal's organization.

### Exploitable Scenarios
1. Obtain any valid session (or invoke function if endpoint exposure permits).
2. Call `manage-staff` with `user_id` of an admin from victim org and `action: delete` on target user.
3. Function verifies role using spoofed `user_id` under service role and executes destructive operation.

---

## 3) Input Validation & Injection Risks

### Injection Risk List
- **Command injection**: no direct shell execution observed in app runtime paths reviewed.
- **SQL injection**: low direct risk through Supabase query builder; however, authorization flaws make this secondary.
- **Prompt injection risk** in AI chat flow due to direct interpolation of user question + business context sent to external model runtime.

### Validation Weak Points
- Weak schema enforcement for request bodies in edge functions (no shared Zod/DTO layer).
- Inconsistent type/shape validation (`items` sometimes parsed from string, partial checks only).
- Trust of optional control fields (`manualOverride`, test bypass references) in payment verification flow.

### Recommended Mitigations
- Add strict schema validation (Zod) at all edge function boundaries.
- Reject unknown fields and enforce enums/ranges.
- Remove dev/test bypass paths from production code; gate via environment and signed internal auth only.

---

## 4) Business Logic Review

### Business Logic Exploits
- **Order placement trust flaw**: function accepts caller `user_id` and places pending orders with service role.
- **Race/state issues**: Redis stock decrement then SQL write with best-effort rollback can leave stock drift under failures/retries.

### Payment System Risks
- Hardcoded verification secrets in function source.
- Manual override/test bypass logic enables non-bank settlement paths if reachable.
- Error handling returns HTTP 200 on failures in payment flow, increasing ambiguous client handling and fraud monitoring blind spots.

### Subscription Bypass Risks
- Organization creation path appears publicly invokable and lacks anti-automation/rate-limiting controls.

### Logical Design Flaws
- In one payment function path, variable scope/consistency issues can produce incorrect amount updates.
- Privileged operations couple business logic and authorization checks in fragile way.

---

## 5) API & Backend Security

### API Security Weaknesses
- Open CORS (`*`) on many sensitive functions.
- No demonstrated rate-limiting or abuse throttling at function entry.
- Service-role key usage as default for user-driven actions.

### Data Leakage Risks
- Hardcoded secrets and keys in repository.
- Potential overexposure through debug/error responses and direct passthrough of upstream AI/payment messages.

### Hardening Recommendations
- Rotate exposed keys immediately.
- Enforce auth token parsing on every privileged function.
- Add per-IP and per-user rate limits.
- Return semantically correct HTTP status codes for security telemetry.

---

## 6) LLM / AI Security

### AI Attack Surface Analysis
- `master-intelligence` forwards user text plus tenant context to external Flowise endpoint.
- Tenant context selection is influenced by client-provided org/branch IDs.

### Prompt Injection Scenarios
- Malicious user asks model to ignore instructions and leak embedded context.
- Cross-tenant probing by submitting other tenant IDs if backend checks are absent.

### Tool Execution Risks
- AI function currently behaves as privileged data broker without strong caller-tenant verification.

### Recommended Guardrails
- Bind org/branch from verified claims only.
- Add model-side output filtering and refusal policies for sensitive context.
- Add per-tenant context ACL checks before assembling prompts.

---

## 7) Frontend Security

### Frontend Exploit Scenarios
- Frontend sends `user_id` in function bodies; attacker can replay/modify requests outside UI.
- API keys may be exposed in build-time defines if environment contains sensitive model keys.

### Client-Side Trust Violations
- Client route guards are not security boundaries.
- LocalStorage is used broadly (theme, branch selection, and cleared wholesale on signout); avoid storing sensitive auth material manually.

### Recommended Fixes
- Remove identity fields from client payloads where server can derive them.
- Keep secrets out of Vite `define` for browser bundles.
- Add CSP and stricter frontend security headers at deployment edge.

---

## 8) Deployment & Infrastructure

### Deployment Risks
- React Query Devtools included in app render path (not clearly environment-gated).
- CORS wildcard in backend functions.

### Infrastructure Weaknesses
- Secret management hygiene issues (hardcoded keys in source).
- No visible WAF/rate-limiter policy from repository evidence.

### Operational Security Gaps
- Ambiguous error/status responses reduce monitoring signal quality.
- Limited explicit alerting/incident hooks visible in code.

---

## 9) Code Quality & Maintainability

### Technical Debt Report
- Repeated auth patterns across many functions with inconsistent env var names.
- Security-sensitive logic duplicated per function rather than shared middleware.

### Maintainability Risks
- Mixed naming and env usage (`SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_ROLE_KEY`).
- Monolithic function handlers combine validation/auth/business/side-effects.

### Suggested Refactor Strategy
1. Build shared `security.ts` for edge functions (JWT parse, role checks, tenant checks).
2. Adopt strict request/response schemas.
3. Split each function into handlers: `validate -> authorize -> execute -> audit`.
4. Add integration tests for authz matrix and tenant isolation.

---

## Critical Vulnerabilities (Fix Immediately)
1. Caller-controlled `user_id` used for authorization in service-role functions.
2. Hardcoded secrets/API keys in repository and runtime code.
3. Multi-tenant context derivation from untrusted request body in AI and ordering/payment paths.
4. Payment verification bypass features (`manualOverride`, test reference shortcuts) in production path.

## High Risk Issues
- CORS wildcard on privileged endpoints.
- No visible rate limiting / abuse controls.
- Service role used broadly for user-originated workflows.

## Medium Risk Issues
- Inconsistent HTTP error semantics (200 for failures).
- Debug/developer tooling and observability inconsistencies.
- Potential state drift between Redis and SQL in failure scenarios.

## Low Risk Issues
- Role/path UX mismatch in unauthorized redirect logic.
- General layering and naming inconsistency increasing future defect risk.

---

## Security Hardening Checklist
- [ ] Rotate all exposed keys/secrets and purge from git history if required.
- [ ] Enforce JWT validation and claim-based identity in every edge function.
- [ ] Remove `user_id`, `organization_id`, `branch_id` trust from client body for auth decisions.
- [ ] Implement centralized authz middleware and tenant guard.
- [ ] Lock CORS to known origins.
- [ ] Add rate limiting and anomaly detection.
- [ ] Add schema validation for all request bodies.
- [ ] Remove payment bypass/debug logic from production.
- [ ] Add end-to-end authz tests (horizontal/vertical/tenant).

## Business Logic Fix Recommendations
- Introduce idempotency keys for order/payment mutation endpoints.
- Make stock reservation atomic (DB transaction or compensation job with reconciliation).
- Use immutable payment ledger events and strict reconciliation before status transitions.
- Gate AI context retrieval by server-verified tenant claims.
