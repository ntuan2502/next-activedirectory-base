---
type: project
created: 2026-06-14
updated: 2026-06-15
---

# Project Conventions

## Git Workflow
- Always create a new dedicated branch for major code changes.
- Branch name format should follow: `feature/[task-slug]` or `fix/[bug-slug]`.

## Package Manager & Tool Execution
- **ALWAYS** use `pnpm` as the package manager.
- **NEVER** use `npx`. Instead, use `pnpx` or `pnpm dlx` for executing commands/tools.

## Quality Control & Verification
- **ALWAYS** run `pnpm lint` to check for code quality issues and ensure lint checks pass before finalizing any response to the user, **ONLY** when there are code changes.

## TypeScript Coding Standards
- **STRICTLY FORBIDDEN** to use the `any` type under all circumstances. Always use precise type declarations, generics, or `unknown` where applicable.

## Database & Prisma Workflow
- When schema changes or drift are detected in development, **ALWAYS** use `pnpm prisma migrate dev` to generate migration files and safely apply updates to the database.

## Logging & Audit Logs
- When any entity changes (create, update, delete), the ID of this entity must always be recorded in the target field or details of the audit log.

## Password Inputs & Security UI
- **ALWAYS** include a show/hide password toggle (eye icon / `Eye` and `EyeOff` from `lucide-react`) for all password input fields in the application (such as Login, Setup, Account Profile, and Add User / Reset Password dialogs).

## Internationalization & Localization (i18n)
- **STRICTLY FORBIDDEN** to use hardcoded (raw) text or strings anywhere in the project (including UI labels, placeholders, buttons, titles, alert messages, toast notifications, console logs, and backend API responses).
- **ALWAYS** define translation keys in all supported locales (`vi.ts`, `en.ts`, `ja.ts`, `th.ts`) and fetch them dynamically using the translation function (`t(...)` or backend localization equivalent).

## UI Spacing & Card Layout
- **ALWAYS** ensure card padding (khoảng cách tới viền) does not exceed Tailwind class value `4` (which is `1rem` or `16px`). Make sure NOT to double pad (nếu parent `<Card>` đã có padding thì `<CardContent>` giữ padding mặc định) để tránh vượt quá giới hạn 16px này.





