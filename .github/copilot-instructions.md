# KZ Serviços Web App — Project Guidelines

## Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **Linting:** ESLint + Prettier
- **Package Manager:** npm

## Architecture
- `app/` — Pages and API routes (Next.js App Router)
- `src/components/` — Reusable UI components
- `src/lib/` — Utility functions and shared logic
- `src/types/` — TypeScript type definitions
- `docs/specs/` — Design specifications
- `docs/plans/` — Implementation plans
- `__tests__/` — Test files mirroring source structure

## Development Methodology
This project follows the **Superpowers** methodology. All development must follow this workflow:

1. **Brainstorm** — Explore requirements and design before code (use `brainstorming` skill)
2. **Plan** — Write detailed implementation plans (use `writing-plans` skill)
3. **Implement with TDD** — RED → GREEN → REFACTOR (use `test-driven-development` skill)
4. **Debug systematically** — Root cause analysis before fixes (use `systematic-debugging` skill)
5. **Verify** — Evidence before claims (use `verification-before-completion` skill)
6. **Review** — Code review between tasks (use `requesting-code-review` skill)

## Conventions
- All UI text and responses in **Portuguese (pt-BR)**
- Use Server Components by default; `'use client'` only when necessary
- No `any` types — use proper TypeScript types
- Follow existing code patterns when modifying existing files
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`

## Build and Test Commands
```bash
npm install        # Install dependencies
npm run dev        # Start development server
npm run build      # Production build
npm test           # Run tests
npm run lint       # Run linter
```

## Skills Available
See `.github/skills/` for all available development skills. Key skills:
- `brainstorming` — Design before code
- `writing-plans` — Bite-sized implementation tasks
- `test-driven-development` — TDD workflow
- `systematic-debugging` — Root cause analysis
- `verification-before-completion` — Evidence before claims
- `executing-plans` — Plan execution with checkpoints
- `subagent-driven-development` — Parallel task execution
- `requesting-code-review` / `receiving-code-review` — Code review workflow
- `dispatching-parallel-agents` — Independent parallel tasks
- `using-git-worktrees` — Isolated workspaces
- `finishing-a-development-branch` — Branch completion workflow
