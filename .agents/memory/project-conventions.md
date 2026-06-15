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
