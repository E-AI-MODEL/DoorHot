import { spawnSync } from "node:child_process";

const repository =
  process.env.GITHUB_REPOSITORY ??
  process.env.DOOR010_GITHUB_REPOSITORY;
const branch = process.env.PROTECTED_BRANCH ?? "main";
const dryRun = process.argv.includes("--dry-run");

if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
  throw new Error(
    "Set GITHUB_REPOSITORY or DOOR010_GITHUB_REPOSITORY to OWNER/REPO."
  );
}

const requiredContexts = [
  "Verify Node.js workspace",
  "Run browser parity tests",
  "PostgreSQL, providers and browser acceptance"
];

const protection = {
  required_status_checks: {
    strict: true,
    contexts: requiredContexts
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    dismiss_stale_reviews: true,
    require_code_owner_reviews: true,
    required_approving_review_count: 1,
    require_last_push_approval: true
  },
  restrictions: null,
  required_linear_history: true,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: true,
  lock_branch: false,
  allow_fork_syncing: true
};

const endpoint =
  `repos/${repository}/branches/${encodeURIComponent(branch)}/protection`;

if (dryRun) {
  console.log(JSON.stringify({
    endpoint,
    protection
  }, null, 2));
  process.exit(0);
}

if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  throw new Error(
    "Set GH_TOKEN to a token with repository administration permission."
  );
}

const result = spawnSync(
  "gh",
  [
    "api",
    "--method",
    "PUT",
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    "X-GitHub-Api-Version: 2026-03-10",
    endpoint,
    "--input",
    "-"
  ],
  {
    input: JSON.stringify(protection),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  }
);

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  throw new Error("Applying branch protection failed.");
}

const verify = spawnSync(
  "gh",
  [
    "api",
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    "X-GitHub-Api-Version: 2026-03-10",
    endpoint
  ],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }
);

if (verify.status !== 0) {
  process.stderr.write(verify.stderr);
  throw new Error("Branch protection verification failed.");
}

const current = JSON.parse(verify.stdout);
const currentContexts =
  current.required_status_checks?.contexts?.map(
    (item) => typeof item === "string" ? item : item.context
  ) ?? [];

for (const context of requiredContexts) {
  if (!currentContexts.includes(context)) {
    throw new Error(`Required check missing after update: ${context}`);
  }
}

console.log(
  `Branch protection for ${repository}:${branch} is active and verified.`
);
