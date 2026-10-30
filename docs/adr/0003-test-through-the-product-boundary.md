---
status: accepted
date: 2026-10-16
---

# Test behavior through the running browser, real API, and persistence

Nearhood's most important guarantees cross UI, API, database, and evidence relationships. Use the running browser with real application APIs and persistence as the main automated behavioral testing boundary, as confirmed in the spec. Assert observable outcomes rather than internal function calls or a particular generated sentence.

Sources: the testing decisions in [spec #1](../issues/1.md), [slice #3](../issues/3.md), and the [test setup](../../README.md#verification).

## Consequences and responsibilities

- Playwright runs mobile and desktop journeys against a real application server and a dedicated PostgreSQL/PostGIS test database. Setup migrates and seeds that database; it must not target production user data.
- Assertions cover visible behavior and contracts: correct claim evidence, preserved originals after reload, separate/unknown times, empty viewports, denied geolocation, and cross-Happening isolation.
- Smaller tests may supplement these journeys for isolated rules. They do not substitute for proving the integrated product path.
- Later processing tests can control responses at the external model-service boundary, and control time/location inputs, while retaining real application APIs and persistence. Separate runtime demonstrations must exercise the actual model integration.
- Human review remains necessary for evidence comprehensibility, misleading certainty, responsive presentation, and exploratory failure cases. Production smoke checks establish deployment health separately from local suite results.

Compared with heavily mocked component tests, this catches more integration and persistence failures, at the cost of slower tests and additional environment setup. Control external variability without mocking away the application behavior being verified. Fix flaky tests by investigating timing or isolation problems rather than assuming retries prove correctness.

## Implementation and verification status

[Playwright configuration](../../playwright.config.ts) and [browsing tests](../../tests/browse.spec.ts) implement this boundary for #3. All 12 mobile/desktop tests, typechecking, and the production build passed in the October 16 review.

These are revision-specific results, not a guarantee about future changes. Model edge cases, signed-in mutation journeys, and processing failures remain later coverage. Automatic CI execution and a staging environment are not implied by having local test commands.
