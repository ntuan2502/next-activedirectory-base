---
type: project
created: 2026-06-14
updated: 2026-06-14
---

# Project Conventions

## Git Workflow
- Always create a new dedicated branch for major code changes.
- Branch name format should follow: `feature/[task-slug]` or `fix/[bug-slug]`.

## Package Manager & Tool Execution
- **ALWAYS** use `pnpm` as the package manager.
- **NEVER** use `npx`. Instead, use `pnpx` or `pnpm dlx` for executing commands/tools.

## Quality Control & Verification
- **ALWAYS** run `pnpm run lint` (or `pnpm exec eslint .`) to check for code quality issues and ensure lint checks pass before finalizing any response to the user.

## TypeScript Coding Standards
- **STRICTLY FORBIDDEN** to use the `any` type under all circumstances. Always use precise type declarations, generics, or `unknown` where applicable.
