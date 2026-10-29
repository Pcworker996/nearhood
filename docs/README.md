# Developer documentation

Start with the task below. **Requirements and current task status live in [GitHub Issues](https://github.com/Pcworker996/nebius-hack/issues); documents explain contracts, decisions, operating procedures, and evidence.**

## Find information by task

| I need to…                                            | Read                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Run the app, configure services, or run tests         | [Repository README](../README.md#run-locally); contribution/model setup is in [Report submission](implementation/report-submission.md#setup-and-verification).                                                                                                                                                           |
| Understand the domain and evidence relationships      | [Domain glossary](../CONTEXT.md), then [product guardrails](product-guardrails.md).                                                                                                                                                                                                                                      |
| Understand why the architecture works this way        | [ADR index](adr/README.md): evidence separation, server-owned persistence, testing boundary, and match confirmation.                                                                                                                                                                                                     |
| Change Report submission, processing, or matching     | [Accepted matching strategy](proposals/report-matching-strategy.md), [ADR 0005](adr/0005-separate-extraction-from-matching.md), and [ticket #4](https://github.com/Pcworker996/nebius-hack/issues/4); [Report submission](implementation/report-submission.md) retains the historical implementation contract and setup. |
| Design an LLM workflow or evaluate model quality      | [Agent architecture and evaluation guide](guides/agent-architecture-and-evaluation.md#start-here); [verified source notes](research/agent-evaluation-source-notes.md) contain vendor/version details.                                                                                                                    |
| Review general engineering and verification practices | [Software quality guide](guides/software-quality.md).                                                                                                                                                                                                                                                                    |
| Diagnose database connection/TLS failures             | [Supabase TLS troubleshooting](troubleshooting/supabase-tls.md).                                                                                                                                                                                                                                                         |
| Inspect verification evidence for an earlier revision | [Review records](reviews/README.md).                                                                                                                                                                                                                                                                                     |
| Understand the accepted matching revision             | [Report matching strategy](proposals/report-matching-strategy.md). **Accepted October 21; implementation and evaluation outstanding.**                                                                                                                                                                                   |
| Resume earlier work or review personal notes          | [Engineering journal](journal/README.md), [October 16 entry](journal/2026-10-16.md), and [October notes](journal/2026-10-notes.md). These are historical context.                                                                                                                                                        |
| Configure an AI coding agent's repository workflow    | [Root instructions](../AGENTS.md), [issue tracker](agents/issue-tracker.md), [triage labels](agents/triage-labels.md), and [domain documentation rules](agents/domain.md).                                                                                                                                               |

## Templates

- [Scoped verification workflow and worksheet](guides/scoped-verification.md): define a milestone's scope, claims, evidence and acceptance decisions.
- [Daily engineering log](journal/daily-template.md): copy to `journal/YYYY-MM-DD.md`.
- [Monthly ideas and reflections](journal/monthly-notes-template.md): copy to `journal/YYYY-MM-notes.md`.
- [Design proposal](proposals/proposal-template.md): copy to `proposals/descriptive-topic.md`.

## Read the right kind of document

| Document type           | Authority and scope                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GitHub issue            | Requirements, acceptance criteria, blockers, and current task status.                                            |
| `CONTEXT.md`            | Shared terminology and relationships.                                                                            |
| `product-guardrails.md` | Standing product constraints.                                                                                    |
| `adr/`                  | Accepted architectural decisions, rationale, and consequences. An accepted direction is not proof of deployment. |
| `implementation/`       | Feature contracts, lifecycle, endpoints, setup, and implementation checkpoints linked to issues.                 |
| `guides/`               | Reusable engineering practices and worksheets. Examples do not add product scope.                                |
| `proposals/`            | Unaccepted options and design discussion. Promote an agreed decision into an issue/ADR before implementation.    |
| `research/`             | Dated primary-source findings and version caveats.                                                               |
| `troubleshooting/`      | Symptom-led diagnosis and operating procedures.                                                                  |
| `reviews/`              | Verification evidence tied to a revision and environment.                                                        |
| `journal/`              | Chronological progress and personal reflection; not current requirements or operating instructions.              |

## Jump from documentation to code

| Responsibility                                             | Entry point                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Public browsing and evidence projection                    | [Read repository](../src/lib/database.ts); [HTTP routes](../src/app/api/happenings).  |
| Report validation, ownership, and saved-state reads        | [Submission module](../src/lib/report-submission.ts).                                 |
| Processing states, confirmation, and publication           | [Processing orchestration](../src/lib/report-processing.ts).                          |
| Deterministic candidate retrieval                          | [Matching search](../src/lib/report-matching.ts).                                     |
| Model request, structured output, and reference validation | [Model integration](../src/lib/report-model.ts).                                      |
| Contribution and candidate-review interface                | [Contribution UI](../src/components/contribution.tsx).                                |
| Persistence and schema changes                             | [Ordered migrations](../db/migrations); [setup runner](../scripts/setup-database.ts). |
| Live model compatibility checks                            | [Model checker](../scripts/check-report-model.ts).                                    |
| User journeys and provider fixtures                        | [Browser tests](../tests); [Playwright configuration](../playwright.config.ts).       |

## Structure and maintenance

```text
docs/
├── README.md               # Navigation and documentation conventions
├── product-guardrails.md   # Standing product constraints; stable path
├── adr/                   # Accepted decisions; numbered records
├── agents/                # Repository instructions for coding agents
├── implementation/        # Feature contracts and setup
├── guides/                # Reusable engineering and evaluation practices
├── proposals/             # Draft designs awaiting agreement
├── research/              # Dated sources and version-specific findings
├── troubleshooting/       # Symptom → diagnosis → remedy
├── reviews/               # Revision-specific verification records
└── journal/               # Daily logs, ideas, and reflections
```

- Use descriptive, kebab-case topic filenames; include issue links inside feature documents. Keep dates in historical records and numbers in ADRs.
- Put purpose, scope/status, and applicable date or revision near the top. Distinguish accepted, implemented, verified, deployed, and proposed behavior.
- Keep canonical information in one place. Link to setup commands, contracts, and requirements rather than maintaining competing copies.
- Add a task-oriented entry here when introducing a document people will need to find. Avoid a README in every single-file directory.
- When moving a document, update inbound links and its relative links to code, other docs, and root files. Keep `CONTEXT.md`, `docs/adr/`, agent-instruction paths, and `docs/product-guardrails.md` stable unless their callers are deliberately migrated.
- Preserve dated review/journal records as evidence of what was known then. Correct misleading status in active reference documents rather than treating old test results as current verification.
