## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for Pcworker996/nebius-hack.
See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels.
See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout: root `CONTEXT.md` and `docs/adr/`.
See `docs/agents/domain.md`.

### Product guardrails

Apply `docs/product-guardrails.md` when making design and implementation choices.
Preserve the distinction between Reports, Observations, Happenings, and the
provisional Shared Account. Prioritize inspectable evidence, chronology,
spatial scope, disagreement, and uncertainty over engagement or feature breadth.

### Concept-to-implementation traceability

Every product or engineering concept proposed for implementation must include
enough detail to build and review it without guessing. Connect the higher-level
goal to the concrete user/system behavior, affected data and relationships,
lifecycle or state transitions, storage/API/UI responsibilities, important
failure and uncertainty cases, and acceptance criteria. Mark what is agreed,
what is only illustrative, and what remains undecided. Link the approach to its
GitHub issue or design document; do not present a concept as implemented until
the behavior exists and has been verified.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
