# CLAUDE.md

Read `AGENTS.md` first — it is the source of truth for setup, commands, and
coding practices. This file only adds Claude-specific policy.

## Model policy

- **Never use Haiku models** for subagents or any work in this repo.
- **Prefer Opus or Fable** for all non-trivial work (features, bug fixes,
  refactors, reviews).
- Sonnet is acceptable only for very simple mechanical changes: renames,
  formatting, single-line fixes, comment edits.
- When spawning subagents, apply the same rules to the subagent's model.

_(Note: the main session's model is chosen by the user in their client; these
rules govern what Claude controls — subagent model selection and
recommendations.)_

## Working style

- Write or update tests for behavior changes and run them (`bun run test:unit`)
  before claiming completion; validate with `bun typecheck` and `bun lint`.
- Keep code clean with brief explanatory notes where they help the next
  reader (see AGENTS.md → Coding practices).
- Use bun for everything; never npm/pnpm/yarn.
