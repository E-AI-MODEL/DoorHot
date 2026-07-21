// Smoke-checks the configured LLM endpoint. It reads the same env contract
// the app uses (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL), sends one fixed
// question to the OpenAI-compatible /chat/completions endpoint and reports
// the model, HTTP status, latency and the first lines of the answer.
//
// It proves the route is *live*, not that it is *good*: answer quality still
// needs the separate with/without-LLM comparison described in the README.
//
// It never prints the API key and fails with a clear message (exit 1) when no
// endpoint is configured, so it is safe to run anywhere.

const baseUrl = process.env.LLM_BASE_URL;
const apiKey = process.env.LLM_API_KEY;
const model = process.env.LLM_MODEL;

function fail(message) {
  console.error(`[verify:llm] ${message}`);
  process.exit(1);
}

if (!baseUrl || !apiKey || !model) {
  const missing = [
    !baseUrl && "LLM_BASE_URL",
    !apiKey && "LLM_API_KEY",
    !model && "LLM_MODEL"
  ]
    .filter(Boolean)
    .join(", ");
  fail(
    `geen LLM geconfigureerd (ontbreekt: ${missing}). ` +
      "Zet een OpenAI-compatible endpoint, of een HF-token zodat " +
      "`npm run demo` de router-tier kiest, en probeer opnieuw."
  );
}

const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
const question =
  "Wat is de pabo en voor welk onderwijs leidt die op? Antwoord kort.";
const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? "60000");

console.log(`[verify:llm] endpoint: ${endpoint}`);
console.log(`[verify:llm] model:    ${model}`);
console.log(`[verify:llm] vraag:    ${question}`);

const startedAt = Date.now();
let response;
try {
  response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "Geef een correct, duidelijk en beknopt antwoord in het Nederlands."
        },
        { role: "user", content: question }
      ]
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });
} catch (error) {
  fail(
    `aanroep mislukt na ${Date.now() - startedAt} ms: ` +
      `${error instanceof Error ? error.message : String(error)}`
  );
}

const latencyMs = Date.now() - startedAt;
const rawBody = await response.text();
console.log(`[verify:llm] status:   HTTP ${response.status}`);
console.log(`[verify:llm] latency:  ${latencyMs} ms`);

if (!response.ok) {
  fail(`endpoint gaf een fout: ${rawBody.slice(0, 400)}`);
}

let answer;
try {
  const parsed = JSON.parse(rawBody);
  answer = parsed?.choices?.[0]?.message?.content;
} catch {
  fail(`kon het antwoord niet als JSON lezen: ${rawBody.slice(0, 400)}`);
}

if (!answer || typeof answer !== "string" || !answer.trim()) {
  fail("het endpoint gaf een leeg antwoord terug");
}

const preview = answer
  .trim()
  .split("\n")
  .slice(0, 6)
  .join("\n");
console.log("[verify:llm] antwoord (eerste regels):");
console.log(preview);
console.log("[verify:llm] OK - de LLM-route is live.");
