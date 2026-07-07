---
type: project
created: 2026-06-14
updated: 2026-07-07
---

# Project Conventions & Guidelines

This document consolidates all project conventions, user preferences, coding standards, and past corrections to guide the Agent.

## I. Communication & Environment (User Preferences)
- **ALWAYS** respond and write all user-facing content (including chat messages, task lists (`task.md`), and walkthroughs (`walkthrough.md`)) in **Vietnamese**.
- **DO NOT** use automated browser subagents (`browser_subagent`) to test UI changes. The user will manually test UI changes.
- **ALWAYS** write code, comments, variables, and database schemas in **English**.
- Adhere strictly to **SOLID**, **DRY**, and **Clean Code** principles. Code should be concise, direct, self-documenting, and avoid over-engineering.

## II. TypeScript Coding Standards
- **STRICTLY FORBIDDEN** to use the `any` type under all circumstances. Always use precise type declarations, generics, or `unknown` where applicable. **This rule applies strictly to all files in the repository, including utility scripts, helper files, and configurations, without exception.**
- **STRICTLY FORBIDDEN** to use `eslint-disable` directives in any files created or modified by the agent, unless no other workaround is possible and it is explicitly approved by the user. **This rule also applies to all dev scripts and auxiliary files.**
- **ALWAYS** create script and codebase files in TypeScript (`.ts`/`.tsx`). **NEVER** create raw JavaScript (`.js`/`.jsx`) files.

## III. Quality Control & Verification (Feedback History)
- **ALWAYS** run `pnpm lint` (which runs `eslint && tsc --noEmit`) to check for code quality and compilation errors before replying **whenever code changes are made**. Do not finalize responses with code changes without passing lint checks.
- **ALWAYS** proactively run the translation check script (`pnpm check-i18n`) whenever code or translation files are modified to detect missing or unused keys across locales, and fix them automatically.

## IV. Git & Package Manager Workflow
- **ALWAYS** use `pnpm` as the package manager. **NEVER** use `npm` or `npx` (use `pnpx` or `pnpm dlx` instead).
- **ALWAYS** create a new dedicated branch for major code changes (format: `feature/[task-slug]` or `fix/[bug-slug]`).

## V. Database & Prisma Workflow
- When schema changes or drift are detected in development, **ALWAYS** use `pnpm prisma migrate dev` to generate migration files and safely apply updates to the database.

## VI. Audit Logs
- When any entity changes (create, update, delete), the ID of this entity must always be recorded in the target field or details of the audit log.

## VII. UI Design & Layout Standards
- **ALWAYS** include a show/hide password toggle (eye icon / `Eye` and `EyeOff` from `lucide-react`) for all password input fields in the application (such as Login, Setup, Account Profile, and Add User / Reset Password dialogs).
- **STRICTLY FORBIDDEN** to use hardcoded (raw) text or strings anywhere in the UI (including labels, placeholders, buttons, titles, alert messages, toast notifications, console logs, and backend API responses). Use translation keys (`t(...)`) in all supported locales (`vi.ts`, `en.ts`, `ja.ts`, `th.ts`).
- **ALWAYS** ensure card padding (khoảng cách tới viền) does not exceed Tailwind class value `4` (which is `1rem` or `16px`). Make sure NOT to double pad (nếu parent `<Card>` đã có padding thì `<CardContent>` giữ padding mặc định) để tránh vượt quá giới hạn 16px này.

## VIII. UI/UX & State Optimization
- **ALWAYS** optimize UI transitions in Next.js nested layouts by fetching and caching shared dropdown database lists (like companies, users, departments) at the layout level (using context provider) and initializing state synchronously in sub-pages. Avoid local fetch triggers or skeleton-loading state resetting on mount to eliminate UI flicker/frequent re-renders.
