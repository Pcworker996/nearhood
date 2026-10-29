# Building software that works and serves its purpose

A practical guide for the Nearhood product owner and developers.

For an actionable process and copyable worksheet, use [Verification within a defined scope](scoped-verification.md).

**Reference snapshot:** the project-status examples near the end reflect October 16, 2026. Use [GitHub issues](https://github.com/Pcworker996/nebius-hack/issues) for current task status and [Report submission](../implementation/report-submission.md) for the contribution contract. The engineering practices below are reusable guidance.

**Status:** This is an educational guide and a suggested working process, not a claim that every practice below is implemented. Examples involving contribution, matching, processing, or account updates describe later workflows. They do not expand the agreed V1 scope. Product requirements remain in [GitHub issues](https://github.com/Pcworker996/nebius-hack/issues), terminology in [CONTEXT.md](../../CONTEXT.md), and standing principles in the [product guardrails](../product-guardrails.md).

## 1. Quality starts with the goal

Software quality means more than “the code runs.” Useful software must solve the intended problem, behave correctly, preserve data, handle failures, and remain understandable enough to change safely.

For Nearhood, the central goal is helping a reader understand what the available evidence supports about a local Happening. A fast, attractive map can still fail that goal if it presents an uncertain account as established fact.

Two questions help separate different kinds of quality:

- **Verification:** Did we build the behavior correctly? For example, does a claim open the correct supporting Observation and original Report?
- **Validation:** Is this the behavior people need? For example, can a reader actually understand why the account changed?

Automated tests are especially useful for verification. Human walkthroughs, product review, and feedback from users help with validation. Both matter.

**Your role:** State the outcome and judge whether the result makes sense. You can delegate test implementation without delegating the decision about what “correct” means.

## 2. Turn goals into observable acceptance criteria

A goal such as “preserve evidence” is too broad to implement or test on its own. Translate it into behavior someone can observe.

Use this chain:

> Product goal → concrete scenario → expected behavior → implementation responsibilities → verification evidence.

For example, an illustrative later workflow:

| Part              | Example                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Goal              | Readers understand partial improvement without assuming full resolution.                                                         |
| Scenario          | A contributor reports that the south entrance has reopened; the north entrance is unobserved.                                    |
| Expected behavior | The account describes the south entrance and leaves the north entrance uncertain.                                                |
| Data              | Preserve the Report; link its Observation, observation time, and spatial scope to the Happening and relevant account claims.     |
| Responsibilities  | Storage retains evidence; processing assesses scope; the API exposes supporting links; the UI explains the change and unknowns.  |
| Failure behavior  | If processing fails, preserve the saved Report and previous account, with processing state visible.                              |
| Acceptance        | The UI shows partial improvement, the original Report remains inspectable, and no claim asserts that the entire bridge reopened. |

Before implementation, connect this detail to the relevant ticket. Clearly separate confirmed decisions, illustrative examples, and unresolved questions.

**Why this matters:** An agent can implement a vague request consistently and still build the wrong product. Precise acceptance criteria reduce that ambiguity.

## 3. Identify invariants and model state transitions

An **invariant** is a rule that must remain true across operations. It is stronger than checking one screen.

Nearhood examples include:

- An Observation traces back to its original Report.
- Submission time does not replace observation time.
- Important account claims have inspectable evidence links.
- A claim's evidence cannot accidentally come from another Happening.
- Unknown information stays unknown unless supported by new evidence.
- A derived account does not silently overwrite original submitted words.

Enforce rules at the appropriate boundary. Database constraints can protect valid relationships; application checks can enforce permissions and allowed transitions; tests can verify the behavior end to end. A rule appearing in a document is not evidence that the system enforces it.

A **state transition** describes what changes after an action or event. Later Report processing might involve saved, pending, failed, and incorporated states; these are illustrative until the applicable ticket defines them.

For any such workflow, ask:

1. What is the starting state?
2. Which actions are allowed, and who can perform them?
3. What gets saved before external work begins?
4. What happens if work fails or is retried?
5. Can an older result overwrite a newer result?
6. What does the reader see at each point?

These questions expose bugs that a happy-path screenshot cannot reveal.

## 4. Design boundaries so changes remain understandable

**Separation of concerns** means giving different responsibilities clear homes. For example:

- Storage preserves Reports, relationships, timestamps, and account history.
- Application logic applies rules and coordinates work.
- APIs define what clients can request and receive.
- The UI presents evidence and uncertainty clearly.
- Models assist semantic interpretation; they do not become independent evidence.

A **contract** specifies what a boundary accepts, returns, and guarantees, including errors. A public API contract includes valid inputs, response shape, failure codes, and access rules. An internal module can also have a contract.

Clear boundaries make failures easier to locate and behavior easier to test. They do not require a microservice for every responsibility. Keep the implementation proportional to the actual product.

Review code for readability and changeability as well as correctness. Ask whether names explain domain meaning, a rule is duplicated, or changing one behavior requires scattered edits. Prefer simple code that makes the important rule visible.

## 5. Use several kinds of tests

Each kind answers a different question. Terminology varies between teams; the important part is identifying the boundary being tested and which dependencies are real.

| Check                  | What it proves                                  | Nearhood example                                                | Main limitation                                        |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| Static checks          | Code satisfies type and build rules.            | API and UI types compile.                                       | Valid types can describe incorrect behavior.           |
| Unit test              | An isolated rule works for selected inputs.     | A distance calculation handles known coordinates.               | Does not prove the full system is connected correctly. |
| Integration test       | Components work together.                       | A real PostGIS query filters Happenings by bounds.              | May leave out the browser or deployed configuration.   |
| API test               | An HTTP contract behaves correctly.             | Invalid bounds return 400; unrelated claim requests return 404. | Does not prove the UI displays results correctly.      |
| End-to-end test        | A user journey crosses the system successfully. | Open a claim, inspect evidence, reload.                         | Slower and more sensitive to environment and timing.   |
| Exploratory test       | A person investigates unexpected behavior.      | Switch selections quickly while a request is slow.              | Requires judgment and is difficult to repeat exactly.  |
| Production smoke check | Essential deployed paths work.                  | Homepage and API respond; map tiles load.                       | A small check cannot establish every requirement.      |

Choose the smallest boundary that meaningfully proves the behavior. Keep a manageable set of end-to-end tests for critical journeys. Nearhood's confirmed product-testing boundary uses a browser with real APIs and persistence; do not replace that evidence with isolated mocks.

A **mock** substitutes for a dependency. It can make failures repeatable, but also hide integration problems. Controlled model responses can test how the application handles malformed or unsupported output; they cannot prove that a real model performs the task well.

A **regression test** preserves a lesson from a bug: reproduce the failure, make a test fail for the right reason, fix the behavior, and keep the test.

**Test-driven development** is one useful technique: write a failing behavioral test, implement enough to pass, then improve the structure while keeping it passing. It is a technique, not a guarantee of good requirements.

## 6. Test risks and failure cases deliberately

Testing every possible combination is impractical. **Risk-based testing** prioritizes failures by their consequences and likelihood.

For Nearhood, lost original Reports, incorrect evidence links, unauthorized changes, and unsupported resolution claims deserve particular attention. A small spacing error usually has lower impact.

Use a simple matrix for each ticket:

| Requirement or risk      | Scenario                                              | Expected result                                                          | Evidence to collect                                       |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Chronology               | An older observation arrives later.                   | It does not automatically become the latest observed condition.          | Automated chronology scenario and visible account review. |
| Spatial scope            | One entrance reopens.                                 | Remaining extent stays uncertain.                                        | Processing test and browser journey.                      |
| Access boundary          | A different contributor attempts a restricted change. | Server rejects it without changing data.                                 | API test against real authorization.                      |
| External failure         | Processing is unavailable after saving a Report.      | Report survives; previous account remains available; failure is visible. | Controlled failure and retry scenario.                    |
| Deployment configuration | Required configuration is absent or invalid.          | Failure is detectable and understandable.                                | Environment-specific check.                               |

For stateful workflows, also consider duplicate requests, out-of-order completion, network interruption, concurrent edits, empty data, unknown values, and boundary inputs. Define the intended result before writing the test.

**Idempotency** means retrying the same operation does not accidentally create additional effects. This matters when a request succeeds but its response is lost and the caller retries.

Coverage percentages show which code ran, not whether assertions were useful. Prefer tests that would fail if an important rule were broken. Avoid tests that merely repeat the implementation's assumptions.

## 7. Review independently of test results

A passing suite can share the same misunderstanding as the code. Review therefore asks different questions:

- **Product review:** Does this match the ticket and guardrails? Is uncertainty visible?
- **Code review:** Are responsibilities clear? Are errors handled? Are data and permissions protected?
- **Human walkthrough:** Can someone complete the journey and explain what happened?

For each important change, inspect the actual diff and the actual running behavior. Screenshots help assess layout, but do not prove persistence or correct evidence relationships.

When using AI, request a requirements-to-evidence report: which criterion is satisfied, how it was checked, and what remains unverified. A skill running tests is useful automation; the skill's completion message alone is not proof that all requirements passed.

## 8. Release through repeatable gates

An **environment** is a separately configured place where the application runs:

- Development supports implementation and debugging.
- Test uses controlled, isolated data for repeatable checks.
- Staging resembles production and supports release rehearsal.
- Production serves real users.

Keep test writes away from real user data. Staging similarity matters: local tests cannot prove that hosted credentials, TLS, migrations, provider restrictions, or environment variables are correct.

**Continuous integration (CI)** runs agreed checks automatically for changes. A suggested gate is typechecking, production build, and the relevant automated suite. Automatic deployment is a separate choice; CI does not inherently require it.

A practical release sequence is:

1. Confirm acceptance criteria and the affected risks.
2. Implement in a small, reviewable change with relevant tests.
3. Run automated checks and review the diff.
4. Rehearse critical behavior in staging, including applicable migrations.
5. Deploy a known revision with a recovery plan.
6. Run production smoke checks and inspect errors.
7. Record the evidence in the ticket before closing it.

A **rollback** returns to a known previous application version. Database changes can make that unsafe: old code may no longer understand the new schema. Review compatibility and data recovery before a migration. A backup is only useful when restoration is possible and has been rehearsed appropriately.

The existence of this guide does not establish that CI, staging, rollback automation, or backup verification is currently configured.

## 9. Observe production and evaluate model behavior

Tests happen under selected conditions. Production introduces real devices, traffic, provider outages, and unexpected inputs.

**Observability** means having evidence to understand the system's behavior:

- Logs record events and errors with useful context.
- Metrics summarize behavior, such as failure rate and response time.
- Traces connect work across request and processing boundaries.
- Alerts notify someone when a meaningful problem needs attention.

Avoid recording secrets or unnecessary personal information. Assign an owner and response action to alerts; collecting logs without a way to act on them is incomplete.

Monitor product integrity as well as availability. An API can return HTTP 200 while presenting unsupported claims. For model-assisted workflows, maintain representative evaluation cases covering chronology, partial scope, disagreement, shared sources, and unknowns. Review evidence grounding, not just fluent prose.

Use controlled responses for repeatable application tests and separately evaluate the real model integration. Re-evaluate relevant cases when prompts, models, or processing rules change. Neither approach guarantees correct interpretation of every future Report.

## 10. A working agreement between you and the agent

You do not need to personally implement every test. You should understand the important risks and inspect the evidence supporting completion.

| Your responsibility                                        | Agent/developer responsibility                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Explain the user goal and priorities.                      | Translate them into concrete responsibilities and identify ambiguity. |
| Confirm important behavior and tradeoffs.                  | Implement behavior and appropriate checks.                            |
| Walk through the product and challenge misleading results. | Reproduce failures, diagnose causes, and add regression coverage.     |
| Decide whether the evidence supports acceptance.           | Report exact checks, environments, results, and gaps honestly.        |

A useful request for future tickets:

> Before implementing, map the acceptance criteria to concrete behavior, data changes, failure cases, and verification. Preserve the product guardrails. Test through our confirmed browser/real-API/database boundary, with smaller tests where useful. Review the diff and the running journey. Report what passed, which environment was checked, and what remains unverified. Do not treat seeded fixtures as successful live-model processing.

## Current Nearhood reference point

As of the October 16, 2026 review:

- [Ticket #3](https://github.com/Pcworker996/nebius-hack/issues/3) is complete and closed; production is [nearhood-app.vercel.app](https://nearhood-app.vercel.app).
- `npm run typecheck`, `npm run build`, and all 12 mobile/desktop browser tests passed in that checkout. Automated browser tests used a real API and isolated PostgreSQL/PostGIS test database.
- Production homepage and happenings API returned HTTP 200, with six seeded Happenings. The product owner confirmed hosted persistence and live map/attribution checks.
- These checks establish the browsing/evidence slice. They do not establish later contribution, authentication, model processing, or resolution behavior.

See [README.md](../../README.md) for command prerequisites and test-database setup. Before running browser tests, confirm that the configured database is dedicated to testing; setup migrates and seeds it. Historical checks are evidence about a particular revision and environment, not a permanent guarantee about future releases.

The practical aim is confidence proportional to risk: clear goals, explicit rules, reviewable changes, relevant tests, honest release evidence, and a process that turns discovered failures into lasting improvements.
