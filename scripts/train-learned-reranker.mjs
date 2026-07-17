import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const hybrid = JSON.parse(
  await readFile(
    resolve(root, "reports/retrieval/hybrid.json"),
    "utf8"
  )
);
const faqDataset = JSON.parse(
  await readFile(
    resolve(root, "datasets/faq-seed.json"),
    "utf8"
  )
);
const faqByQuestion = new Map(
  faqDataset.faqs.map((faq) => [faq.question, faq])
);

const FEATURE_NAMES = [
  "reciprocal_rank",
  "rrf_score",
  "title_token_overlap",
  "body_token_overlap",
  "tag_token_overlap",
  "title_trigram_similarity",
  "concept_overlap",
  "exact_title_match",
  "query_length_ratio",
  "channel_count"
];

const CONCEPTS = {
  career_change: [
    "omscholen", "overstap", "zij-instroom", "zijinstroom",
    "werken en leren", "meteen werken", "direct werken"
  ],
  next_step: [
    "wat nu", "volgende stap", "volgende stappen",
    "waar begin ik", "na orientatie", "na oriëntatie"
  ],
  duration: [
    "duur", "hoelang", "hoe lang", "binnen hoeveel tijd", "jaar"
  ],
  costs: [
    "kosten", "kost", "betalen", "gratis", "collegegeld"
  ],
  work_schedule: [
    "werkweek", "werktijden", "dagen werken", "combineren",
    "opleiding naast werk"
  ],
  shortage: [
    "tekort", "veel leraren nodig", "schoolvakken",
    "arbeidsmarkt", "vraag naar docenten"
  ],
  route_comparison: [
    "deeltijd", "werken en leren", "verschil", "kiezen"
  ],
  qualification_gap: [
    "zonder passende vakopleiding", "geen verwant diploma",
    "niet verwant"
  ],
  pedagogy_certificate: [
    "pdg", "mbo zonder lerarenopleiding", "pedagogisch didactisch"
  ],
  higher_education: [
    "hogeschool", "hoger onderwijs", "universiteit"
  ],
  extra_pay: [
    "vakantiegeld", "eindejaarsuitkering", "extra uitkering"
  ],
  resources: [
    "bronnen", "tools", "websites", "handige bronnen"
  ]
};

const TYPO_MAP = {
  trajekt: "traject",
  oplijding: "opleiding",
  vakature: "vacature",
  bronne: "bronnen",
  "zij instroom": "zij-instroom",
  "tweede graads": "tweedegraads",
  "kop oplijding": "kopopleiding",
  "onderwijs ondersteuner": "onderwijsondersteuner",
  "her intreder": "herintreder"
};

function normalize(value) {
  let normalized = value
    .toLocaleLowerCase("nl")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [incorrect, corrected] of Object.entries(TYPO_MAP)) {
    normalized = normalized.replaceAll(incorrect, corrected);
  }
  return normalized;
}

function terms(value) {
  return [...new Set(
    normalize(value)
      .split(/\s+/)
      .filter((term) => term.length >= 2)
  )];
}

function trigrams(value) {
  const normalized = `  ${normalize(value)}  `;
  const result = new Set();
  for (let index = 0; index <= normalized.length - 3; index += 1) {
    result.add(normalized.slice(index, index + 3));
  }
  return result;
}

function trigramSimilarity(left, right) {
  const leftSet = trigrams(left);
  const rightSet = trigrams(right);
  const intersection = [...leftSet].filter((item) =>
    rightSet.has(item)
  ).length;
  return intersection / Math.max(leftSet.size, rightSet.size, 1);
}

function concepts(value) {
  const normalized = normalize(value);
  return Object.entries(CONCEPTS)
    .filter(([, phrases]) =>
      phrases.some((phrase) => normalized.includes(phrase))
    )
    .map(([key]) => key);
}

function overlap(leftTerms, rightTerms) {
  const right = new Set(rightTerms);
  return leftTerms.filter((term) => right.has(term)).length /
    Math.max(leftTerms.length, 1);
}

function featureVector(query, candidate, rank) {
  const faq = faqByQuestion.get(candidate.title);
  if (!faq) throw new Error(`Unknown candidate FAQ: ${candidate.title}`);

  const queryTerms = terms(query);
  const titleTerms = terms(faq.question);
  const bodyTerms = terms(faq.answer);
  const tagTerms = terms((faq.tags ?? []).join(" "));
  const queryConcepts = concepts(query);
  const documentConcepts = new Set(
    concepts([
      faq.question,
      faq.answer,
      ...(faq.tags ?? [])
    ].join(" "))
  );
  const conceptOverlap = queryConcepts.filter((concept) =>
    documentConcepts.has(concept)
  ).length / Math.max(queryConcepts.length, 1);
  const queryLength = normalize(query).length;
  const titleLength = normalize(faq.question).length;

  return [
    1 / (rank + 1),
    Number(candidate.score ?? 0),
    overlap(queryTerms, titleTerms),
    overlap(queryTerms, bodyTerms),
    overlap(queryTerms, tagTerms),
    trigramSimilarity(query, faq.question),
    conceptOverlap,
    normalize(query) === normalize(faq.question) ? 1 : 0,
    Math.min(queryLength, titleLength) /
      Math.max(queryLength, titleLength, 1),
    1
  ];
}

function stableBucket(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 20;
}

function splitForGroup(groupId) {
  const bucket = stableBucket(groupId);
  if (bucket < 14) return "train";
  if (bucket < 17) return "validation";
  return "holdout";
}

const rows = [];
const cases = hybrid.cases.map((item) => ({
  ...item,
  split: splitForGroup(
    item.groupId ??
    item.relevantQuestions.slice().sort().join("|")
  )
}));

for (const testCase of cases) {
  testCase.retrieved.forEach((candidate, rank) => {
    rows.push({
      caseId: testCase.id,
      split: testCase.split,
      query: testCase.query,
      queryType: testCase.queryType,
      candidate,
      features: featureVector(testCase.query, candidate, rank),
      label: testCase.relevantIds.includes(candidate.id) ? 1 : 0
    });
  });
}

const weights = Array(FEATURE_NAMES.length).fill(0);
let bias = 0;
const learningRate = 0.08;
const regularization = 0.0005;

function sigmoid(value) {
  if (value >= 0) {
    const exponential = Math.exp(-value);
    return 1 / (1 + exponential);
  }
  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

let bestWeights = [...weights];
let bestBias = bias;
let bestValidationLoss = Number.POSITIVE_INFINITY;
let staleEpochs = 0;

function logLoss(split) {
  const selected = rows.filter((item) => item.split === split);
  if (selected.length === 0) return 0;

  const total = selected.reduce((sum, row) => {
    const prediction = Math.min(
      1 - 1e-9,
      Math.max(1e-9, scoreWith(row, weights, bias))
    );
    return sum - (
      row.label * Math.log(prediction) +
      (1 - row.label) * Math.log(1 - prediction)
    );
  }, 0);
  return total / selected.length;
}

function scoreWith(row, modelWeights, modelBias) {
  return sigmoid(
    row.features.reduce(
      (sum, value, index) =>
        sum + value * modelWeights[index],
      modelBias
    )
  );
}

for (let epoch = 0; epoch < 400; epoch += 1) {
  for (const row of rows.filter((item) => item.split === "train")) {
    const linear = row.features.reduce(
      (sum, value, index) => sum + value * weights[index],
      bias
    );
    const prediction = sigmoid(linear);
    const error = prediction - row.label;
    const classWeight = row.label === 1 ? 8 : 1;

    weights.forEach((weight, index) => {
      weights[index] -= learningRate * (
        classWeight * error * row.features[index] +
        regularization * weight
      );
    });
    bias -= learningRate * classWeight * error;
  }

  const validationLoss = logLoss("validation");
  if (validationLoss + 1e-6 < bestValidationLoss) {
    bestValidationLoss = validationLoss;
    bestWeights = [...weights];
    bestBias = bias;
    staleEpochs = 0;
  } else {
    staleEpochs += 1;
  }

  if (staleEpochs >= 30) break;
}

weights.splice(0, weights.length, ...bestWeights);
bias = bestBias;

function score(row) {
  return scoreWith(row, weights, bias);
}

function metricsFor(split, k = 5) {
  const selectedCases = cases.filter((item) => item.split === split);
  let recall = 0;
  let reciprocalRank = 0;
  let ndcg = 0;
  let brier = 0;
  let predictionCount = 0;

  for (const testCase of selectedCases) {
    const ranked = rows
      .filter((row) => row.caseId === testCase.id)
      .map((row) => ({ ...row, learnedScore: score(row) }))
      .sort((left, right) =>
        right.learnedScore - left.learnedScore
      )
      .slice(0, k);

    const relevantCount = Math.max(
      testCase.relevantIds.length,
      1
    );
    const hits = ranked.filter((row) => row.label === 1).length;
    recall += hits / relevantCount;

    const first = ranked.findIndex((row) => row.label === 1);
    if (first >= 0) {
      reciprocalRank += 1 / (first + 1);
    }

    const dcg = ranked.reduce((sum, row, index) =>
      sum + row.label / Math.log2(index + 2), 0);
    const idealCount = Math.min(k, relevantCount);
    const idcg = Array.from(
      { length: idealCount },
      (_, index) => 1 / Math.log2(index + 2)
    ).reduce((sum, value) => sum + value, 0);
    ndcg += idcg === 0 ? 0 : dcg / idcg;

    for (const row of ranked) {
      brier += (row.learnedScore - row.label) ** 2;
      predictionCount += 1;
    }
  }

  return {
    caseCount: selectedCases.length,
    recallAt5: Number((recall / selectedCases.length).toFixed(4)),
    meanReciprocalRank: Number(
      (reciprocalRank / selectedCases.length).toFixed(4)
    ),
    ndcgAt5: Number(
      (ndcg / selectedCases.length).toFixed(4)
    ),
    brierScore: Number(
      (brier / Math.max(predictionCount, 1)).toFixed(4)
    )
  };
}

const model = {
  version: "door010-learned-linear-v1",
  featureNames: FEATURE_NAMES,
  weights: weights.map((value) => Number(value.toFixed(8))),
  bias: Number(bias.toFixed(8)),
  trainedAt: new Date().toISOString(),
  trainingCases: cases.filter((item) => item.split === "train").length,
  validationCases: cases.filter(
    (item) => item.split === "validation"
  ).length,
  holdoutCases: cases.filter((item) => item.split === "holdout").length,
  splitStrategy: "grouped 70/15/15",
  bestValidationLoss: Number(bestValidationLoss.toFixed(6))
};

const report = {
  modelVersion: model.version,
  splitStrategy:
    "semantic groupId, 70% train / 15% validation / 15% holdout",
  training: metricsFor("train"),
  validation: metricsFor("validation"),
  holdout: metricsFor("holdout"),
  weights: Object.fromEntries(
    FEATURE_NAMES.map((name, index) => [name, model.weights[index]])
  )
};

await writeFile(
  resolve(root, "datasets/learned-reranker-model.json"),
  JSON.stringify(model, null, 2)
);
await writeFile(
  resolve(root, "reports/retrieval/learned-reranker.json"),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
