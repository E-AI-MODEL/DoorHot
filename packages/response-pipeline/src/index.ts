import type {
  AnswerType,
  IntakeBatch,
  IntakeQuestion,
  ResponseMode,
  StructuredResponse,
  VerifiedLink
} from "@door010/contracts";

export interface AnswerTypeRule {
  maxSentences: number;
  requiresLink: boolean;
  allowsIntake: boolean;
  requiresVerifiedSource: boolean;
}

export const ANSWER_TYPE_RULES: Readonly<Record<
  AnswerType,
  AnswerTypeRule
>> = {
  reproductie: {
    maxSentences: 2,
    requiresLink: false,
    allowsIntake: false,
    requiresVerifiedSource: false
  },
  wegwijs: {
    maxSentences: 2,
    requiresLink: true,
    allowsIntake: false,
    requiresVerifiedSource: false
  },
  verkenning: {
    maxSentences: 5,
    requiresLink: false,
    allowsIntake: true,
    requiresVerifiedSource: false
  },
  empathisch_steunend: {
    maxSentences: 3,
    requiresLink: false,
    allowsIntake: false,
    requiresVerifiedSource: false
  },
  bronplichtig: {
    maxSentences: 4,
    requiresLink: true,
    allowsIntake: false,
    requiresVerifiedSource: true
  },
  handoff_mens: {
    maxSentences: 2,
    requiresLink: true,
    allowsIntake: false,
    requiresVerifiedSource: false
  }
};

export const INTERNAL_URLS: Readonly<Record<string, string>> = {
  opleidingen: "/opleidingen",
  vacatures: "/vacatures",
  events: "/events",
  evenementen: "/events",
  kennisbank: "/kennisbank",
  account: "/auth",
  inloggen: "/auth",
  registreren: "/auth",
  dashboard: "/dashboard",
  profiel: "/profile",
  pabo: "/opleidingen",
  "zij-instroom": "/opleidingen",
  zijinstroom: "/opleidingen",
  pdg: "/opleidingen",
  lerarenopleiding: "/opleidingen"
};

export interface ReflectionResult {
  passed: boolean;
  issues: readonly string[];
}

export interface PipelineInput {
  question: string;
  draft: string;
  supportingDetail?: string;
  verifiedLinks?: readonly VerifiedLink[];
  missingSector?: boolean;
  missingLevel?: boolean;
  backendMode?: ResponseMode;
  primaryFollowup?: StructuredResponse["primaryFollowup"];
  secondaryAction?: StructuredResponse["secondaryAction"];
}

export function resolveInternalUrl(text: string): string | null {
  const lower = text.toLowerCase();

  for (const [keyword, url] of Object.entries(INTERNAL_URLS)) {
    if (lower.includes(keyword)) {
      return url;
    }
  }

  return null;
}

export function classifyAnswerType(text: string): AnswerType {
  if (/\bcontact\b|\bafspraa?k\b|\bbellen\b|\bmailen\b|\bloket\b/i.test(text)) {
    return "handoff_mens";
  }

  if (/\bwelke route\b|\bhoe word ik\b|\bopties\b|\bkan ik\b/i.test(text)) {
    return "verkenning";
  }

  if (/\bkost(?:en)?\b|\bsalaris\b|\bbevoegdheid\b|\bdiploma\b|\btoelating\b|\beisen\b/i.test(text)) {
    return "bronplichtig";
  }

  if (/\bwaar vind ik\b|\bpagina\b|\blink\b|\bwebsite\b/i.test(text)) {
    return "wegwijs";
  }

  if (/\bspann|\bangst|\bmoeil|\bstress|\bzwaar|\btwijfel|\bzenuwachtig/i.test(text)) {
    return "empathisch_steunend";
  }

  return "reproductie";
}

export function needsClarification(
  text: string,
  options: {
    missingSector?: boolean;
    missingLevel?: boolean;
    backendMode?: ResponseMode;
  } = {}
): boolean {
  if (options.backendMode === "clarify_batch") {
    return true;
  }

  const broadPatterns = [
    /\bhoe word ik leraar\b/i,
    /\bwelke route\b/i,
    /\bwat zijn mijn opties\b/i,
    /\bik wil in het onderwijs\b/i,
    /\bkan ik overstappen\b/i,
    /\bwaar moet ik beginnen\b/i,
    /\bik weet niet\b/i,
    /\boriënter/i,
    /\bverkennen\b/i
  ];

  const isBroad =
    broadPatterns.some((pattern) => pattern.test(text)) &&
    text.trim().split(/\s+/).length < 20;
  const missingCritical =
    Boolean(options.missingSector) || Boolean(options.missingLevel);
  const specific = text.trim().split(/\s+/).length > 15;

  return isBroad || (missingCritical && !specific);
}

export function buildIntakeQuestions(options: {
  missingSector?: boolean;
  missingLevel?: boolean;
}): readonly IntakeQuestion[] {
  const questions: IntakeQuestion[] = [];

  if (options.missingSector !== false) {
    questions.push({
      id: "sector",
      slotKey: "school_type",
      question: "Voor welke sector interesseer je je?",
      type: "choice",
      options: [
        "PO (basisonderwijs)",
        "VO (voortgezet onderwijs)",
        "MBO"
      ],
      required: true
    });
  }

  if (options.missingLevel !== false) {
    questions.push({
      id: "level",
      slotKey: "admission_requirements",
      question: "Wat is je hoogste opleiding?",
      type: "choice",
      options: ["MBO", "HBO", "WO / universiteit"],
      required: true
    });
  }

  if (questions.length < 3) {
    questions.push({
      id: "context",
      question: "Nog iets wat helpt? (optioneel)",
      type: "open",
      required: false
    });
  }

  return questions.slice(0, 3);
}

function countSentences(text: string): number {
  return text
    .split(/[.!?]+\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}

export function reflectOnDraft(
  draft: string,
  answerType: AnswerType,
  verifiedLinks: readonly VerifiedLink[]
): ReflectionResult {
  const issues: string[] = [];
  const firstSentence = draft.split(/[.!?]+\s*/)[0]?.trim() ?? "";
  const rule = ANSWER_TYPE_RULES[answerType];

  if (firstSentence.length < 10) {
    issues.push(
      "Eerste zin is te kort of beantwoordt de vraag niet direct."
    );
  }

  const sentenceCount = countSentences(draft);
  if (sentenceCount > rule.maxSentences + 2) {
    issues.push(
      `Antwoord is te lang voor type '${answerType}'.`
    );
  }

  if (rule.requiresVerifiedSource && verifiedLinks.length === 0) {
    issues.push(
      "Bronplichtig antwoord heeft geen geverifieerde bron."
    );
  }

  if (
    rule.requiresLink &&
    verifiedLinks.length === 0 &&
    !draft.includes("](")
  ) {
    issues.push("Antwoordtype vereist een klikbare link.");
  }

  const forbidden = [
    "dat weet ik niet",
    "als ai",
    "ik begrijp je helemaal",
    "goed dat je dit vraagt",
    "wat is de beste route voor jou"
  ];

  for (const phrase of forbidden) {
    if (draft.toLowerCase().includes(phrase)) {
      issues.push(`Verboden formulering: "${phrase}".`);
    }
  }

  return {
    passed: issues.length === 0,
    issues
  };
}

export function createStructuredResponse(
  input: PipelineInput
): StructuredResponse {
  const answerType = classifyAnswerType(input.question);
  const clarification = needsClarification(input.question, {
    missingSector: input.missingSector,
    missingLevel: input.missingLevel,
    backendMode: input.backendMode
  });
  const verifiedLinks = [...(input.verifiedLinks ?? [])];
  const internalUrl = resolveInternalUrl(input.question);

  if (
    internalUrl &&
    !verifiedLinks.some((link) => link.href === internalUrl)
  ) {
    verifiedLinks.push({
      label: "Bekijk relevante informatie",
      href: internalUrl,
      sourceKey: "door010-internal"
    });
  }

  const rule = ANSWER_TYPE_RULES[answerType];
  const mode: ResponseMode = clarification
    ? "clarify_batch"
    : rule.requiresVerifiedSource && verifiedLinks.length === 0
      ? "source_check"
      : answerType === "handoff_mens"
        ? "handoff"
        : "direct";

  const reflection = reflectOnDraft(
    input.draft,
    answerType,
    verifiedLinks
  );

  const intakeBatch: IntakeBatch | undefined =
    clarification && rule.allowsIntake
      ? {
          questions: buildIntakeQuestions({
            missingSector: input.missingSector,
            missingLevel: input.missingLevel
          }),
          summaryTemplate:
            "Sector: {school_type}; niveau: {admission_requirements}; context: {context}"
        }
      : undefined;

  return {
    mode,
    answerType,
    directAnswer: input.draft.trim(),
    supportingDetail: input.supportingDetail?.trim() || undefined,
    verifiedLinks,
    primaryFollowup: input.primaryFollowup,
    secondaryAction: input.secondaryAction,
    intakeBatch,
    collapseRecommended:
      Boolean(input.supportingDetail?.trim()),
    verificationRequired: rule.requiresVerifiedSource,
    reflectionIssues: reflection.issues
  };
}
