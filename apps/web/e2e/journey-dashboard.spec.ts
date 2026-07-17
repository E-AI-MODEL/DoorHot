import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "journey@example.nl",
  roles: ["candidate"]
};

const ids = {
  journey: "22222222-2222-4222-8222-222222222222",
  goal: "33333333-3333-4333-8333-333333333333",
  milestone: "44444444-4444-4444-8444-444444444444",
  blocker: "55555555-5555-4555-8555-555555555555",
  action: "66666666-6666-4666-8666-666666666666",
  notification: "77777777-7777-4777-8777-777777777777",
  execution: "88888888-8888-4888-8888-888888888888"
};

async function authenticated(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("door010.accessToken", "journey-token");
  });
  await page.route("**/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user)
    });
  });
}

function dashboard(state: {
  milestoneDone: boolean;
  blockerResolved: boolean;
  actionDone: boolean;
}) {
  return {
    aggregate: {
      journey: {
        id: ids.journey,
        userId: user.id,
        phaseKey: "matching",
        routeKey: "zij-instroom-vo",
        status: "active",
        progress: state.actionDone ? 0.8 : 0.55
      },
      goals: [{
        id: ids.goal,
        title: "Starten als docent",
        description: "Vind een passende route naar het VO.",
        status: "active",
        priority: 90
      }],
      milestones: [{
        id: ids.milestone,
        goalId: ids.goal,
        title: "Toelatingseisen controleren",
        status: state.milestoneDone ? "completed" : "pending",
        weight: 1,
        sortOrder: 0
      }],
      blockers: [{
        id: ids.blocker,
        blockerKey: "financiering",
        title: "Financiering is nog niet rond",
        severity: "high",
        confidence: 0.9,
        status: state.blockerResolved ? "resolved" : "open"
      }],
      actions: [{
        id: ids.action,
        goalId: ids.goal,
        blockerId: ids.blocker,
        actionKey: "adviesgesprek",
        title: "Plan een adviesgesprek",
        status: state.actionDone ? "done" : "pending",
        priority: 100
      }],
      evidence: [{
        id: "99999999-9999-4999-8999-999999999999",
        claimKey: "preferred_sector",
        confidence: 0.95
      }],
      decisions: []
    },
    nextAction: state.actionDone ? undefined : {
      id: ids.action,
      actionKey: "adviesgesprek",
      title: "Plan een adviesgesprek",
      status: "pending",
      priority: 100
    },
    openCriticalBlockers: []
  };
}

async function mockDashboardApis(page: Page) {
  const state = {
    milestoneDone: false,
    blockerResolved: false,
    actionDone: false
  };

  await page.route(`**/v1/journeys/${user.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dashboard(state))
    });
  });
  await page.route(`**/v1/memory-graph/${user.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        graph: { nodes: [], edges: [] },
        activeGoals: [{ id: ids.goal, label: "Starten als docent" }],
        openBlockers: state.blockerResolved ? [] : [{
          id: ids.blocker,
          label: "Financiering is nog niet rond"
        }],
        pendingActions: state.actionDone ? [] : [{
          id: ids.action,
          label: "Plan een adviesgesprek"
        }],
        evidence: [{
          id: "99999999-9999-4999-8999-999999999999",
          label: "preferred_sector"
        }]
      })
    });
  });
  await page.route(`**/v1/notifications/${user.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [{
          id: ids.notification,
          executionRequestId: ids.execution,
          userId: user.id,
          channel: "in_app",
          body: "Je adviesgesprek is morgen.",
          deliverAt: "2026-08-01T09:00:00.000Z",
          status: "delivered",
          attempts: 1
        }]
      })
    });
  });
  await page.route(`**/v1/journeys/${user.id}/actions/${ids.action}`, async (route) => {
    state.actionDone = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ action: { id: ids.action, title: "Plan een adviesgesprek", actionKey: "adviesgesprek", status: "done", priority: 100 } }) });
  });
  await page.route(`**/v1/journeys/${user.id}/milestones/${ids.milestone}`, async (route) => {
    state.milestoneDone = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ milestone: { id: ids.milestone, title: "Toelatingseisen controleren", status: "completed", weight: 1, sortOrder: 0 } }) });
  });
  await page.route(`**/v1/journeys/${user.id}/blockers/${ids.blocker}/resolve`, async (route) => {
    state.blockerResolved = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ blocker: { id: ids.blocker, blockerKey: "financiering", title: "Financiering is nog niet rond", severity: "high", confidence: 0.9, status: "resolved" } }) });
  });

  return state;
}

test("journey-dashboard toont voortgang, context en notificaties", async ({ page }) => {
  await authenticated(page);
  await mockDashboardApis(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Mijn traject" }).click();

  await expect(page.getByRole("heading", { name: "Jouw voortgang en volgende stap" })).toBeVisible();
  await expect(page.locator("strong", { hasText: "55%" })).toBeVisible();
  await expect(page.getByText("matching")).toBeVisible();
  await expect(page.getByText("zij-instroom-vo")).toBeVisible();
  await expect(page.getByText("Je adviesgesprek is morgen.")).toBeVisible();
});

test("journey-dashboard verwerkt acties, milestones en blockers", async ({ page }) => {
  await authenticated(page);
  const state = await mockDashboardApis(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Mijn traject" }).click();

  await page.locator(".action-complete").click();
  await expect.poll(() => state.actionDone).toBe(true);

  await page.locator(".milestone-complete").click();
  await expect.poll(() => state.milestoneDone).toBe(true);

  await page.locator(".blocker-resolve").click();
  await expect.poll(() => state.blockerResolved).toBe(true);

  await expect(page.getByText("Geen open blokkades.")).toBeVisible();
  await expect(page.getByText("Geen open acties.")).toBeVisible();
});
