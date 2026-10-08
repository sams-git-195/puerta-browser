@AGENTS.md
@.agents/rules/claude-agent-protocol.md

# CLAUDE.md

`AGENTS.md` is the source of truth for setup, commands, and coding practices, and the
protocol above is the team process — both are imported at the top of this file. This file
only adds Claude-specific policy.

## Model policy

- **Never use Haiku models** for subagents or any work in this repo.
- **Prefer Opus or Fable** for all non-trivial work (features, bug fixes,
  refactors, reviews).
- Sonnet is acceptable only for very simple mechanical changes: renames,
  formatting, single-line fixes, comment edits.
- When spawning subagents, apply the same rules to the subagent's model.
- Built-in and plugin subagent types (Explore, Plan, general-purpose, …) pick their own model unless told:
  always pass `model: opus` (or `fable`) explicitly when dispatching them.
- **Current models:** Opus 5.5 (`claude-opus-5-5`) and Sonnet 5.5 (`claude-sonnet-5-5`). The agent
  files in `.claude/agents/` use the `opus` alias, which follows the latest Opus. The OpenCode
  side pins full IDs (`opencode.json`, `.opencode/agents/*.md`) — when a newer model ships, update
  those together with the protocol's model matrix (§3).

_(Note: the main session's model is chosen by the user in their client; these
rules govern what Claude controls — subagent model selection and
recommendations.)_

## Working style

- Write or update tests for behavior changes and run them (`bun run test:unit`)
  before claiming completion; validate with `bun run typecheck` and `bun run lint`
  (the full gate list is in `AGENTS.md` → Dev commands).
- Keep code clean with brief explanatory notes where they help the next
  reader (the engineering standard is protocol §2).
- Use bun for everything; never npm/pnpm/yarn.
