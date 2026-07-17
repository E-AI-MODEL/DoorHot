import { createServer } from "node:http";
import {
  JsonEventScraper,
  JsonVacancyProvider,
  OpenAiCompatibleAnswerDraftProvider,
  WebhookNotificationProvider
} from "@door010/integrations";

const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const path = request.url ?? "/";

  response.setHeader("Content-Type", "application/json");

  if (path === "/v1/chat/completions") {
    response.end(JSON.stringify({
      choices: [{
        message: {
          content: "Acceptatieantwoord"
        }
      }]
    }));
    return;
  }

  if (path.startsWith("/vacancies")) {
    response.end(JSON.stringify({
      vacancies: [{
        id: "vacancy-acceptance",
        title: "Docent acceptatietest"
      }]
    }));
    return;
  }

  if (path.startsWith("/events")) {
    response.end(JSON.stringify({
      events: [{
        title: "Acceptatie-evenement"
      }]
    }));
    return;
  }

  if (path === "/notifications") {
    response.end(JSON.stringify({
      messageId: "notification-acceptance"
    }));
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not_found" }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("Mock provider failed to start.");
}
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const llm = new OpenAiCompatibleAnswerDraftProvider({
    baseUrl: `${baseUrl}/v1`,
    apiKey: "acceptance-key",
    model: "acceptance-model"
  });
  const vacancy = new JsonVacancyProvider({
    endpoint: `${baseUrl}/vacancies`
  });
  const events = new JsonEventScraper();
  const notifications = new WebhookNotificationProvider(
    `${baseUrl}/notifications`
  );

  const draft = await llm.createDraft(
    "general-coach",
    { message: "Test" },
    { slots: [] }
  );
  const vacancies = await vacancy.list();
  const scraped = await events.scrape({
    name: "acceptance",
    url: `${baseUrl}/events`
  });
  const notification = await notifications.send({
    recipient: "acceptance-user",
    templateKey: "acceptance",
    subject: "Acceptatie",
    variables: {}
  });

  if (draft.directAnswer !== "Acceptatieantwoord") {
    throw new Error("LLM contract failed.");
  }
  if (vacancies[0]?.title !== "Docent acceptatietest") {
    throw new Error("Vacancy contract failed.");
  }
  if (scraped[0]?.title !== "Acceptatie-evenement") {
    throw new Error("Event contract failed.");
  }
  if (notification.messageId !== "notification-acceptance") {
    throw new Error("Notification contract failed.");
  }

  console.log("Provider contract acceptance passed.");
} finally {
  server.close();
}
