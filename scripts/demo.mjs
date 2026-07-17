import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Starts the in-memory demo stack: the API dev server (seeded at boot
// with all reference data) plus the Vite webapp. Everything runs
// locally in one process tree; Ctrl+C stops both.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function start(name, args, extraEnv = {}) {
  const child = spawn("npm", args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
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
    console.log(`[${name}] gestopt (exit ${code ?? "?"})`);
    shutdown(code ?? 0);
  });

  return child;
}

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

console.log("Door010 demo start: API (in-memory) + webapp");
console.log("Webapp: http://127.0.0.1:5173  |  API: http://127.0.0.1:4000");

children.push(
  start("api", ["run", "dev", "--workspace", "@door010/api"], {
    DATASETS_DIRECTORY:
      process.env.DATASETS_DIRECTORY ?? resolve(root, "datasets")
  })
);
children.push(
  start("web", [
    "run",
    "dev",
    "--workspace",
    "@door010/web",
    "--",
    "--host",
    "127.0.0.1"
  ])
);
