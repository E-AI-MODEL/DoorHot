import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "flow@example.nl",
  roles: ["candidate"]
};

async function authenticated(page: Page): Promise<void> {
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

test("routeflow doorloopt een vraag en toont een route", async ({ page }) => {
  await authenticated(page);
  await page.route("**/v1/routes/sessions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "22222222-2222-4222-8222-222222222222",
        userId: user.id,
        selectedAnswerIds: [],
        status: "active",
        result: {
          nextQuestion: {
            id: "school",
            question: "Waar wil je werken?",
            answers: [{ id: "po", title: "Basisonderwijs" }]
          }
        }
      })
    });
  });
  await page.route("**/v1/routes/sessions/*/answers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "22222222-2222-4222-8222-222222222222",
        userId: user.id,
        selectedAnswerIds: ["po"],
        status: "completed",
        result: {
          bestRoute: {
            id: "route-1",
            title: "Route naar leerkracht PO",
            slug: "route-po",
            steps: [{
              id: "step-1",
              shortTitle: "Pabo",
              longTitle: "Volg de pabo",
              durationInMonths: 48
            }]
          }
        }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Route" }).click();
  await page.getByRole("button", { name: "Basisonderwijs" }).click();

  await expect(page.getByText("Route naar leerkracht PO")).toBeVisible();
});

test("talententest toont de beste sector", async ({ page }) => {
  await authenticated(page);
  await page.route("**/v1/talent-test/questions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions: [{
          id: "q1",
          question: "Wat doe je graag?",
          options: [{ value: "help", label: "Mensen helpen" }]
        }]
      })
    });
  });
  await page.route("**/v1/talent-test/submit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        primarySector: "po",
        rankedSectors: [{
          sector: "po",
          score: 1,
          label: "Primair onderwijs",
          description: "Werken met jonge leerlingen."
        }]
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Talententest" }).click();
  await page.getByText("Mensen helpen").click();
  await page.getByRole("button", { name: "Toon mijn resultaat" }).click();

  await expect(page.getByText("Primair onderwijs")).toBeVisible();
});

test("events en vacatures kunnen worden opgeslagen", async ({ page }) => {
  await authenticated(page);
  await page.route("**/v1/events", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: [{
          id: "33333333-3333-4333-8333-333333333333",
          sourceName: "Onderwijs010",
          sourceUrl: "https://example.test",
          title: "Open dag",
          retrievedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2030-01-01T00:00:00.000Z"
        }]
      })
    });
  });
  await page.route("**/v1/events/*/save", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ saved: true })
    });
  });
  await page.route("**/v1/vacancies**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ saved: true })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        vacancies: [{
          id: "vacancy-1",
          title: "Docent wiskunde",
          organization: "Rotterdam College"
        }]
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Evenementen" }).click();
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expect(page.getByRole("button", { name: "Opgeslagen" }))
    .toBeDisabled();

  await page.getByRole("button", { name: "Vacatures" }).click();
  await expect(page.getByText("Docent wiskunde")).toBeVisible();
});

test("kandidaat verstuurt een bericht naar een adviseur", async ({ page }) => {
  await authenticated(page);
  await page.route("**/v1/conversations/*/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ messages: [] })
    });
  });
  await page.route("**/v1/chat/candidate", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: {
          id: "message-1",
          conversationId: body.conversationId,
          role: "user",
          content: body.message,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Adviseur" }).click();
  await page.getByPlaceholder("Typ een bericht…").fill("Kun je mij helpen?");
  await page.getByRole("button", { name: "Versturen" }).click();

  await expect(page.getByText("Nog geen berichten.")).toBeVisible();
});
