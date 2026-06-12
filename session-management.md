# Project Plan: Database-Backed Session Management

This plan details the implementation of database-tracked user sessions, enabling list display and specific/bulk revocation (sign out other devices, sign out all devices, or sign out a single session) directly from the `/account` page.

## Key Goals & Architectural Decisions

1. **Session Table in DB**:
   - Create a `Session` model in Prisma linked to the `User`.
   - Store session metadata: ID, IP Address, User-Agent, Created time, Last active time.

2. **Session Cookie Sync**:
   - The JWT token will store the `sessionId`.
   - On request validation (`getSession()`), we query the database to verify if this `sessionId` is still active. If not found (meaning revoked), the session is rejected.

3. **API & Interface**:
   - `GET /api/auth/sessions`: Retrieve active sessions.
   - `DELETE /api/auth/sessions`: Revoke active sessions (all, other, or single ID).
   - Account page updates: Render session list, parse browser/OS, and support one-click revocations with SweetAlert2 verification.

---

## Strategic Open Questions (Socratic Gate)

Please review and provide feedback on the following questions:

1. **User Agent Parsing**:
   - Should we write a simple regex helper to parse the User-Agent header and display friendly names (e.g. `Chrome on Windows 11`, `Safari on iOS`), or just display the raw User-Agent string?
2. **Session Expiration & Cleanup**:
   - Since JWT sessions expire after 8 hours, should we implement a database cleanup (e.g., delete db sessions older than 8 hours during new login) to prevent data bloat?
3. **Database Migration Method**:
   - Should we run a direct schema sync using `npx prisma db push` (quick and suitable for fast iteration), or generate a formal migration via `npx prisma migrate dev --name add-sessions`?

---

## Detailed Step-by-Step Breakdown

### Phase 1: Database Migration
- Add `Session` model in [schema.prisma](prisma/schema.prisma).
- Establish relation in `User` model (`sessions Session[]`).
- Execute database sync (e.g. `npx prisma db push` or migration).

### Phase 2: Session & Auth Core Nâng cấp
- Update `SessionPayload` type in [session.ts](src/lib/session.ts) to include `sessionId: string`.
- Update `createSession()` to:
  - Generate a new session entry in DB with browser IP/UA.
  - Sign JWT containing the new `sessionId`.
- Update `getSession()` to:
  - Verify JWT.
  - Query DB to verify `sessionId` exists and is active.
- Update `deleteSession()` to clear db record and cookies.

### Phase 3: APIs endpoints
- Build API handler `src/app/api/auth/sessions/route.ts` with `GET` and `DELETE` endpoints.

### Phase 4: UI integration
- Refactor the session settings area in [page.tsx](src/app/(dashboard)/account/page.tsx) to list sessions dynamically.
- Add active controls (revoke single session, other sessions, or all sessions) bound to the sessions API.

---

## Verification Plan

1. **Linting and compilation checks**:
   - Run `pnpm lint` and `pnpm build` to verify there are no typescript/ESLint/Next.js warnings.
2. **Revocation checks**:
   - Log in using two separate sessions (e.g., normal window and private window).
   - From session A, click to revoke session B.
   - Refresh session B and verify it gets automatically redirected to `/login`.
   - Test "sign out other sessions" and "sign out all sessions".
