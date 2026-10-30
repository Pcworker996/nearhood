import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// Agreed seam: the browser, the real HTTP API and PostgreSQL. Only the
// external model and web-search providers are scripted (ADR 0003, ADR 0009).
const fixtures = "http://127.0.0.1:3101";
async function script(
  question: string,
  steps: { name: string; args: Record<string, unknown> }[],
) {
  await fetch(`${fixtures}/discovery-control`, {
    method: "POST",
    body: JSON.stringify({ question, steps }),
  });
}
async function ask(page: Page, question: string) {
  // Opened by link: the dev overlay can cover the bottom navigation on mobile.
  await page.goto("/?discover=1");
  await page.getByLabel("Your question").fill(question);
  const answered = page.waitForResponse((r) =>
    r.url().endsWith("/api/discover"),
  );
  await page.getByRole("button", { name: "Ask Nearhood" }).click();
  await answered;
  await expect(
    page.getByRole("button", { name: "Ask Nearhood" }),
  ).toBeEnabled();
}
const search = (text: string) => ({
  name: "search_happenings",
  args: { text, category: "any" },
});
const open = (happeningId: string) => ({
  name: "get_happening_evidence",
  args: { happeningId },
});

test("an answer keeps only stored, cited evidence and shows how it was found", async ({
  page,
}) => {
  const question = `Can I cross the footbridge? ${randomUUID()}`;
  await script(question, [
    search("footbridge"),
    open("bridge"),
    {
      name: "submit_answer",
      args: {
        noMatchReason: null,
        results: [
          {
            happeningId: "bridge",
            relevance: "Reports describe barriers at the footbridge entrances.",
            claimIds: "$claims",
            unknowns: ["Whether either entrance is open now."],
            // Not in any Report's words, so it must not be shown as a cause.
            cause: {
              summary: "Bridge repairs",
              quote: "the city is repairing the deck",
              reportId: "$report",
              findingUrl: null,
            },
            suggestions: [
              {
                text: "Barriers were reported at both entrances; check the entrance you plan to use.",
                observationIds: "$observation",
              },
              { text: "Cites nothing real.", observationIds: ["invented"] },
              {
                text: "The bridge is safe to cross from the north.",
                observationIds: "$observation",
              },
            ],
          },
          {
            happeningId: "invented-happening",
            relevance: "Made up.",
            claimIds: [],
            unknowns: [],
            cause: null,
            suggestions: [],
          },
        ],
      },
    },
  ]);
  await ask(page, question);
  const steps = page.getByLabel("Discovery steps");
  await expect(steps).toContainText("Searched visible area for “footbridge”");
  await expect(steps).toContainText("Opened Eastbank footbridge closure");
  await expect(steps).toContainText("Removed 4 unsupported items");
  const card = page.getByRole("article", {
    name: "Eastbank footbridge closure",
  });
  await expect(card).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(card.getByText("Cause not reported.")).toBeVisible();
  await expect(card).toContainText("check the entrance you plan to use");
  await expect(card).not.toContainText("safe to cross");
  await expect(card).not.toContainText("Cites nothing real");
  await expect(card).toContainText("Whether either entrance is open now.");
  await expect(card.locator("ul").first().locator("li").first()).toBeVisible();

  await card
    .getByRole("button", { name: /Show on map and open details/ })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Eastbank footbridge closure",
      level: 1,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to map" }).click();
  await expect(page.getByLabel("Discovery steps")).toBeVisible();
  await page.getByRole("button", { name: "Back to map" }).click();
  await expect(page.getByRole("button", { name: "Discover" })).toBeEnabled();
});

test("an empty area says so without inventing results and can expand the search", async ({
  page,
}) => {
  const question = `Anything at the stadium? ${randomUUID()}`;
  await script(question, [
    search("stadium"),
    {
      name: "submit_answer",
      args: {
        results: [],
        noMatchReason: "Nothing stored mentions a stadium.",
      },
    },
  ]);
  await ask(page, question);
  await expect(page.getByText("No stored Happenings match")).toBeVisible();
  await expect(
    page.getByText("Nothing stored mentions a stadium."),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Expand search area" }).click();
  await expect(page.getByLabel("Discovery steps")).toContainText(
    "Searched expanded area for “stadium”",
  );
  await expect(
    page.getByRole("button", { name: "Expand search area" }),
  ).toHaveCount(0);
});

test("the agent's Source check stays separate from evidence and is reused", async ({
  page,
}) => {
  const query = "Alder 3rd Ave streetlamp outage Detroit";
  await fetch(`${fixtures}/tavily-control`, {
    method: "POST",
    body: JSON.stringify({
      query,
      results: [
        {
          title: "Streetlight repairs on Alder Street",
          url: "https://city.example.test/notices/alder-lights",
          content:
            "Crews replaced the fixture at Alder and 3rd; a power line fault caused the outage.",
          published_date: "2026-10-20",
          relation: "conflicts",
        },
        {
          title: "Unrelated festival schedule",
          url: "https://news.example.test/festival",
          content: "A festival downtown this weekend.",
          relation: "unrelated",
        },
      ],
    }),
  });
  const steps = (refused: boolean) => [
    search("streetlamp"),
    open("lamp"),
    {
      name: "check_outside_sources",
      args: {
        happeningId: "lamp",
        query: refused ? "Jules R. streetlamp Alder" : query,
      },
    },
    {
      name: "submit_answer",
      args: {
        noMatchReason: null,
        results: [
          {
            happeningId: "lamp",
            relevance: "A streetlamp was reported dark at this corner.",
            claimIds: "$claims",
            unknowns: [],
            cause: refused
              ? null
              : {
                  summary: "A power line fault, according to a city notice",
                  quote: "a power line fault caused the outage",
                  reportId: null,
                  findingUrl: "https://city.example.test/notices/alder-lights",
                },
            suggestions: [],
          },
        ],
      },
    },
  ];
  const question = `Why is the lamp out? ${randomUUID()}`;
  await script(question, steps(false));
  await ask(page, question);
  const card = page.getByRole("article", {
    name: "Streetlamp outage on Alder at 3rd",
  });
  await expect(card).toContainText(
    "If anyone is in immediate danger, contact emergency services.",
  );
  await expect(card).toContainText("not Nearhood evidence");
  await expect(
    card.getByRole("link", { name: "city.example.test" }),
  ).toBeVisible();
  const outside = card.getByLabel("Outside sources");
  await expect(outside).toContainText("Conflicts with Reports");
  await expect(
    outside.getByRole("link", { name: "Streetlight repairs on Alder Street" }),
  ).toBeVisible();
  await expect(outside).not.toContainText("festival");
  // Outside findings never become claims.
  await expect(card.getByText("What Reports show")).toBeVisible();
  await expect(card.locator("ul").first()).not.toContainText("power line");
  const searched = (await (await fetch(`${fixtures}/tavily-requests`)).json())
    .length;

  const again = `Why is the lamp out, again? ${randomUUID()}`;
  await script(again, steps(false));
  await ask(page, again);
  await expect(page.getByLabel("Discovery steps")).toContainText(
    "Used outside sources checked",
  );
  expect(
    (await (await fetch(`${fixtures}/tavily-requests`)).json()).length,
  ).toBe(searched);

  await page
    .getByRole("article", { name: "Streetlamp outage on Alder at 3rd" })
    .getByRole("button", { name: /Show on map and open details/ })
    .click();
  await expect(page.getByLabel("Outside sources")).toContainText(
    "Streetlight repairs on Alder Street",
  );

  // A query naming a contributor never leaves the app.
  const named = `Signal question ${randomUUID()}`;
  await script(named, [
    search("signal"),
    open("crossing-signal"),
    {
      name: "check_outside_sources",
      args: {
        happeningId: "crossing-signal",
        query: "Rhea M. east crossing walk signal",
      },
    },
    {
      name: "submit_answer",
      args: { noMatchReason: "Nothing to show.", results: [] },
    },
  ]);
  await ask(page, named);
  await expect(page.getByLabel("Discovery steps")).toContainText(
    "Outside search refused: Queries may not name contributors.",
  );
  const requests: { query: string }[] = await (
    await fetch(`${fixtures}/tavily-requests`)
  ).json();
  expect(requests.some((r) => /rhea/i.test(r.query))).toBe(false);
});

test("a model outage falls back to stored nearby Happenings", async ({
  page,
}) => {
  await ask(page, `Unscripted question ${randomUUID()}`);
  await expect(
    page.getByText(
      "Couldn't interpret your question; showing nearby Happenings.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("article").first()).toBeVisible();
});

test("discovery rejects oversized questions and invalid areas", async ({
  request,
}) => {
  const center = { lat: 42.33, lng: -83.05 };
  const bounds = { west: -83.07, south: 42.32, east: -83.03, north: 42.34 };
  expect(
    (
      await request.post("/api/discover", {
        data: { question: "x".repeat(301), bounds, center },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/discover", {
        data: { question: "ok?", bounds: { ...bounds, south: 50 }, center },
      })
    ).status(),
  ).toBe(400);
});
