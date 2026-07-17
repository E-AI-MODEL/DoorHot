import { writeFile } from "node:fs/promises";

const target = process.env.STAGING_URL ?? process.argv[2];
if (!target) {
  throw new Error("Provide STAGING_URL or a URL argument.");
}

const url = new URL(target);
if (url.protocol !== "https:" && url.hostname !== "localhost") {
  throw new Error("Staging must use HTTPS.");
}

const findings = [];
const checks = [];

function result(id, passed, severity, evidence, recommendation) {
  checks.push({ id, passed, severity, evidence, recommendation });
  if (!passed) {
    findings.push({ id, severity, evidence, recommendation });
  }
}

const response = await fetch(url, {
  redirect: "follow",
  headers: {
    "User-Agent": "Door010-Security-Review/2.7"
  },
  signal: AbortSignal.timeout(20_000)
});

const body = await response.text();
const headers = response.headers;

result(
  "http.status",
  response.status >= 200 && response.status < 400,
  "high",
  `HTTP ${response.status}`,
  "Staging must return a successful response."
);

const requiredHeaders = [
  ["x-content-type-options", /^nosniff$/i],
  ["x-frame-options", /^(deny|sameorigin)$/i],
  ["referrer-policy", /.+/],
  ["content-security-policy", /.+/],
  ["permissions-policy", /.+/]
];

for (const [name, pattern] of requiredHeaders) {
  const value = headers.get(name) ?? "";
  result(
    `header.${name}`,
    pattern.test(value),
    name === "content-security-policy" ? "high" : "medium",
    value || "missing",
    `Configure the ${name} response header.`
  );
}

const setCookie = headers.get("set-cookie") ?? "";
if (setCookie) {
  result(
    "cookies.secure",
    /;\s*secure/i.test(setCookie),
    "high",
    setCookie.replace(/=[^;]*/g, "=[REDACTED]"),
    "Mark authentication cookies Secure."
  );
  result(
    "cookies.httponly",
    /;\s*httponly/i.test(setCookie),
    "high",
    "Cookie attributes inspected.",
    "Mark authentication cookies HttpOnly."
  );
  result(
    "cookies.samesite",
    /;\s*samesite=(strict|lax)/i.test(setCookie),
    "medium",
    "Cookie attributes inspected.",
    "Use SameSite=Lax or SameSite=Strict."
  );
}

const secretPatterns = [
  /sk-[a-zA-Z0-9_-]{20,}/,
  /postgres(?:ql)?:\/\/[^"'\s]+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"']{12,}/i
];

for (const [index, pattern] of secretPatterns.entries()) {
  result(
    `body.secret-pattern-${index + 1}`,
    !pattern.test(body),
    "critical",
    pattern.test(body)
      ? "Potential secret pattern found in unauthenticated HTML."
      : "No match.",
    "Remove secrets from public responses and rotate exposed credentials."
  );
}

result(
  "privacy.noindex-staging",
  /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(body) ||
    /noindex/i.test(headers.get("x-robots-tag") ?? ""),
  "low",
  "Checked meta robots and X-Robots-Tag.",
  "Prevent staging from being indexed by search engines."
);

result(
  "transport.hsts",
  Boolean(headers.get("strict-transport-security")),
  "medium",
  headers.get("strict-transport-security") ?? "missing",
  "Enable HSTS after confirming HTTPS-only operation."
);

const report = {
  generatedAt: new Date().toISOString(),
  target: url.origin,
  finalUrl: response.url,
  passed: findings.every(
    (finding) => !["critical", "high"].includes(finding.severity)
  ),
  checks,
  findings
};

await writeFile(
  "staging-security-review.json",
  JSON.stringify(report, null, 2)
);

const markdown = [
  "# Door010 staging security/privacy review",
  "",
  `- Target: ${report.target}`,
  `- Generated: ${report.generatedAt}`,
  `- Result: ${report.passed ? "PASS" : "FAIL"}`,
  "",
  "## Findings",
  "",
  ...(findings.length
    ? findings.map(
        (finding) =>
          `- **${finding.severity.toUpperCase()} — ${finding.id}**: ` +
          `${finding.evidence} ${finding.recommendation}`
      )
    : ["No findings."]),
  "",
  "## Checks",
  "",
  ...checks.map(
    (check) =>
      `- ${check.passed ? "PASS" : "FAIL"} — ${check.id}: ${check.evidence}`
  )
].join("\n");

await writeFile("staging-security-review.md", markdown);

console.log(markdown);

if (!report.passed) {
  process.exitCode = 1;
}
