import { expect, test } from "@playwright/test";

// End-to-end smoke without route mocks: the browser talks through the
// Vite proxy to the really running API (registration, coach pipeline,
// retrieval over the seeded knowledge base) and state survives a page
// reload. This proves the integration the mocked suites cannot.

test("volledige keten: registreren, vraag stellen, herladen", async ({
  page
}) => {
  const email = `smoke-${Date.now()}@example.test`;
  const password = "sterk-smoke-wachtwoord-123";

  await page.goto("/");

  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord").fill(password);
  await page
    .getByTestId("account-form")
    .getByRole("button", { name: "Registreren" })
    .click();

  await expect(
    page.getByRole("navigation").getByRole("button", { name: email })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Algemene coach" })
    .click();
  await page
    .getByTestId("chat-message")
    .fill("Wat is een zij-instroomtraject?");
  await page
    .getByRole("button", { name: "Versturen" })
    .click();

  const conversation = page.locator("#conversation");
  await expect(
    conversation.locator("article.message.user")
  ).toContainText("zij-instroomtraject");
  await expect(
    conversation.locator("article.message.assistant").last()
  ).toContainText(/zij-instroom/i, { timeout: 15_000 });

  await page.reload();

  await page.getByRole("button", { name: email }).click();
  await expect(
    page.getByRole("heading", { name: "Welkom terug" })
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByText(email)
  ).toBeVisible();
});
