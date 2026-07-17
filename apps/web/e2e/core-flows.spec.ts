import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "test@example.nl",
  roles: ["candidate"]
};

async function mockSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("door010.accessToken", "test-token");
  });

  await page.route("**/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user)
    });
  });
}

test("publieke chat toont het antwoord van de algemene coach", async ({
  page
}) => {
  await page.route("**/v1/chat/general", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        chatbotKey: "general-coach",
        message: "Een zij-instroomtraject combineert werken en leren.",
        artifacts: [
          {
            type: "link",
            label: "Bekijk officiële informatie",
            payload: {
              href: "https://example.test/zij-instroom"
            }
          }
        ],
        sources: [],
        mutations: []
      })
    });
  });

  await page.goto("/");
  await page.getByTestId("chat-message").fill(
    "Wat is zij-instroom?"
  );
  await page.getByRole("button", { name: "Versturen" }).click();

  await expect(
    page.getByText(
      "Een zij-instroomtraject combineert werken en leren."
    )
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Bekijk officiële informatie"
    })
  ).toBeVisible();
});

test("gebruiker kan inloggen", async ({ page }) => {
  await page.route("**/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "test-token",
        expiresAt: "2030-01-01T00:00:00.000Z",
        user
      })
    });
  });
  await page.route(`**/v1/profiles/${user.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "22222222-2222-4222-8222-222222222222",
        userId: user.id,
        knownSlots: {},
        testCompleted: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.getByLabel("E-mailadres").fill(user.email);
  await page.getByLabel("Wachtwoord").fill("sterk-wachtwoord-123");
  await page
    .getByTestId("account-form")
    .getByRole("button", { name: "Inloggen" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Jouw onderwijsprofiel" })
  ).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();
});

test("profiel kan worden geladen en opgeslagen", async ({ page }) => {
  await mockSession(page);

  await page.route(`**/v1/profiles/${user.id}`, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          userId: user.id,
          ...body,
          knownSlots: {},
          testCompleted: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "22222222-2222-4222-8222-222222222222",
        userId: user.id,
        firstName: "Sam",
        preferredSector: "VO",
        knownSlots: {},
        testCompleted: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Profiel" }).click();
  await expect(page.getByLabel("Voornaam")).toHaveValue("Sam");

  await page.getByLabel("Voornaam").fill("Samantha");
  await page.getByRole("button", { name: "Profiel opslaan" }).click();

  await expect(page.getByLabel("Voornaam")).toHaveValue("Samantha");
});

test("persoonlijke chat gebruikt de ingelogde gebruiker", async ({
  page
}) => {
  await mockSession(page);

  await page.route("**/v1/chat/personal", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.userId).toBe(user.id);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        chatbotKey: "personal-journey-coach",
        message: "Je volgende stap is je voorkeurssector bevestigen.",
        artifacts: [],
        sources: [],
        mutations: []
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Mijn coach" }).click();
  await page.getByTestId("chat-message").fill(
    "Wat is mijn volgende stap?"
  );
  await page.getByRole("button", { name: "Versturen" }).click();

  await expect(
    page.getByText(
      "Je volgende stap is je voorkeurssector bevestigen."
    )
  ).toBeVisible();
});

test("beheerder ziet kandidaten en promptbeheer", async ({ page }) => {
  const administrator = {
    ...user,
    roles: ["administrator"]
  };

  await page.addInitScript(() => {
    localStorage.setItem("door010.accessToken", "admin-token");
  });
  await page.route("**/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(administrator)
    });
  });
  await page.route("**/v1/backoffice/candidates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        candidates: [
          {
            userId: user.id,
            displayName: "Sam Kandidaat",
            email: "sam@example.nl",
            currentPhaseCode: "orientatie",
            routeTitle: "Zij-instroom VO",
            lastDetectorConfidence: 0.82
          }
        ]
      })
    });
  });
  await page.route("**/v1/backoffice/statistics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        statistics: {
          totalCandidates: 1,
          candidatesWithRoute: 1,
          candidatesWithoutRoute: 0,
          lowConfidenceCandidates: 0,
          phaseDistribution: { orientatie: 1 },
          upcomingAppointments: 0,
          openAlerts: 0
        }
      })
    });
  });
  await page.route("**/v1/backoffice/alerts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ alerts: [] })
    });
  });
  await page.route("**/v1/backoffice/provider-status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        providers: [
          {
            providerKey: "llm",
            configured: true,
            circuitState: "closed",
            failureCount: 0
          }
        ]
      })
    });
  });
  await page.route("**/v1/backoffice/provider-dead-letters**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ deadLetters: [] })
    });
  });
  await page.route("**/v1/backoffice/execution-requests**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ requests: [] })
    });
  });
  await page.route("**/v1/backoffice/notification-outbox**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] })
    });
  });
  await page.route("**/v1/backoffice/orchestration-runs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ runs: [] })
    });
  });
  await page.route("**/v1/backoffice/planner-shadow**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ evaluations: [] })
    });
  });
  await page.route("**/v1/backoffice/connectors/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ health: [], activeScheduleCount: 0 })
    });
  });
  await page.route("**/v1/backoffice/prompts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        prompts: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            chatbotKey: "general-coach",
            configKey: "default",
            title: "Algemene coach",
            activeVersion: 1,
            versions: [
              {
                id: "44444444-4444-4444-8444-444444444444",
                promptConfigId:
                  "33333333-3333-4333-8333-333333333333",
                version: 1,
                systemPrompt:
                  "Geef betrouwbare antwoorden met duidelijke bronnen.",
                status: "approved",
                createdAt: "2026-01-01T00:00:00.000Z"
              }
            ]
          }
        ]
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Backoffice" }).click();

  await expect(page.getByText("Sam Kandidaat")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Algemene coach" })
  ).toBeVisible();
  await expect(page.getByTestId("candidate-table")).toContainText(
    "82%"
  );
});
