import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function load(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

const base = resolve(process.cwd(), "datasets");
const phaseQuestions = await load(`${base}/phase-detector-questions.json`) as {
  slots: Record<string, unknown>;
  phase_to_questions: Record<string, unknown>;
  question_catalog: Record<string, unknown>;
};
const phaseRules = await load(`${base}/phase-detector-rules.json`) as {
  slots: Record<string, unknown>;
  phases: unknown[];
};
const routeQuestions = await load(`${base}/route-questions.json`) as unknown[];
const routeSteps = await load(`${base}/route-steps.json`) as unknown[];
const faqs = await load(`${base}/faq-seed.json`) as { faqs: unknown[] };
const desks = await load(`${base}/regional-education-desks.json`) as unknown[];

const actual = {
  detectorQuestions: Object.keys(phaseQuestions.question_catalog).length,
  slots: Object.keys(phaseQuestions.slots).length,
  detectorPhases: Object.keys(phaseQuestions.phase_to_questions).length,
  rulePhases: phaseRules.phases.length,
  routeQuestions: routeQuestions.length,
  routeSteps: routeSteps.length,
  faqs: faqs.faqs.length,
  regionalDesks: desks.length
};

const expected = {
  detectorQuestions: 654,
  slots: 9,
  detectorPhases: 5,
  rulePhases: 5,
  routeQuestions: 4,
  routeSteps: 66,
  faqs: 48,
  regionalDesks: 52
};

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error({ expected, actual });
  process.exit(1);
}

console.log({ status: "ok", ...actual });
