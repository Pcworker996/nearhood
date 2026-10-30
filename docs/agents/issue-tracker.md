# Issue tracker: GitHub

Issues and PRDs live in GitHub Issues for Pcworker996/nebius-hack, a private tracker; `docs/issues/` holds a dated public snapshot.
Use the gh CLI from this repo; it infers the repository from origin.

## Conventions

- Create: `gh issue create --title "..." --body-file <file>`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body-file <file>`
- Add labels: `gh issue edit <number> --add-label "..."`
- Remove labels: `gh issue edit <number> --remove-label "..."`
- Close: `gh issue close <number>`

Write multiline issue bodies and comments to a file and use --body-file.
Use docs/agents/triage-labels.md for triage label names.

## Pull requests as a triage surface

PRs as a request surface: no.

## Skill terminology

“Publish to the issue tracker” means create a GitHub issue.
“Fetch the relevant ticket” means read the issue and its comments.

## Wayfinding

Use one issue labelled wayfinder:map for the map and linked child issues
for tickets. Label children wayfinder:research, wayfinder:prototype,
wayfinder:grilling, or wayfinder:task.

Prefer GitHub sub-issues; otherwise use a task list in the map and
“Part of #<map>” in each child.

Prefer native GitHub issue dependencies; otherwise record
“Blocked by: #<number>” in the child. A ticket is unblocked when all
blockers are closed.

Choose the first open, unassigned, unblocked child in map order.
Claim it with `gh issue edit <number> --add-assignee @me`.
Resolve it by commenting with the result, closing it, and adding
a summary and link to the map’s Decisions-so-far.
