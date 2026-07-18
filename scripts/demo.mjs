import { spawn, spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Starts the in-memory demo stack: the API dev server (seeded at boot
// with all reference data) plus the Vite webapp. When Ollama is
// available a small local LLM from Hugging Face powers the coach;
// without it the coach answers extractively from the knowledge base.
// Everything runs in one process tree; Ctrl+C stops both.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [];
let stopping = false;

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  process.exitCode = code;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function start(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const prefix = (line) => `[${name}] ${line}`;
  child.stdout.on("data", (chunk) => {
    for (const line of String(chunk).split("\n")) {
      if (line.trim()) console.log(prefix(line));
    }
  });
  child.stderr.on("data", (chunk) => {
    for (const line of String(chunk).split("\n")) {
      if (line.trim()) console.error(prefix(line));
    }
  });
  child.on("exit", (code) => {
    if (options.optional) return;
    console.log(`[${name}] gestopt (exit ${code ?? "?"})`);
    shutdown(code ?? 0);
  });

  children.push(child);
  return child;
}

async function reachable(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(1500)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureDemoLlm() {
  if (process.env.LLM_BASE_URL) {
    console.log("[llm] LLM_BASE_URL is al geconfigureerd");
    return {};
  }

  const model =
    process.env.DEMO_LLM_MODEL ??
    "hf.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M";
  const hasOllama =
    spawnSync("ollama", ["--version"], { stdio: "ignore" })
      .status === 0;

  if (!hasOllama) {
    console.log(
      "[llm] Ollama niet gevonden - de coach antwoordt " +
      "extractief uit de kennisbank (bash " +
      "scripts/setup-demo-llm.sh installeert de demo-LLM)"
    );
    return {};
  }

  const endpoint = "http://127.0.0.1:11434";
  if (!(await reachable(`${endpoint}/api/tags`))) {
    start("llm", "ollama", ["serve"], { optional: true });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (await reachable(`${endpoint}/api/tags`)) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`[llm] model controleren/ophalen: ${model}`);
  const pull = spawnSync("ollama", ["pull", model], {
    stdio: "inherit"
  });
  if (pull.status !== 0) {
    console.log(
      "[llm] model ophalen mislukt - verder zonder LLM"
    );
    return {};
  }

  console.log(`[llm] actief: ${model}`);
  return {
    LLM_BASE_URL: `${endpoint}/v1`,
    LLM_API_KEY: "ollama-demo",
    LLM_MODEL: model,
    LLM_TIMEOUT_MS: process.env.LLM_TIMEOUT_MS ?? "120000"
  };
}

console.log("Door010 demo start: API (in-memory) + webapp");
console.log(
  "Webapp: http://127.0.0.1:5173  |  API: http://127.0.0.1:4000"
);

const llmEnv = await ensureDemoLlm();

start("api", "npm", ["run", "dev", "--workspace", "@door010/api"], {
  env: {
    DATASETS_DIRECTORY:
      process.env.DATASETS_DIRECTORY ?? resolve(root, "datasets"),
    ...llmEnv
  }
});
start("web", "npm", [
  "run",
  "dev",
  "--workspace",
  "@door010/web",
  "--",
  "--host",
  "127.0.0.1"
]);
