import { describe, expect, it } from "vitest";
import {
  buildIntakeQuestions,
  classifyAnswerType,
  createStructuredResponse,
  needsClarification,
  reflectOnDraft
} from "../src/index.js";

describe("response pipeline", () => {
  it("classifies source-sensitive questions as bronplichtig", () => {
    expect(
      classifyAnswerType("Wat kost een pabo-opleiding?")
    ).toBe("bronplichtig");
  });

  it("creates at most three intake questions", () => {
    expect(
      buildIntakeQuestions({
        missingSector: true,
        missingLevel: true
      })
    ).toHaveLength(3);
  });

  it("detects broad exploration questions", () => {
    expect(
      needsClarification("Welke route past bij mij?")
    ).toBe(true);
  });

  it("requires a verified source for source-sensitive answers", () => {
    const reflection = reflectOnDraft(
      "De kosten verschillen per opleiding.",
      "bronplichtig",
      []
    );

    expect(reflection.passed).toBe(false);
    expect(reflection.issues).toContain(
      "Bronplichtig antwoord heeft geen geverifieerde bron."
    );
  });

  it("keeps the direct answer visible and only collapses detail", () => {
    const response = createStructuredResponse({
      question: "Hoe word ik leraar?",
      draft: "Je route hangt af van sector en vooropleiding.",
      supportingDetail:
        "Daarna vergelijken we bevoegdheden, opleidingen en toelating."
    });

    expect(response.directAnswer).toBe(
      "Je route hangt af van sector en vooropleiding."
    );
    expect(response.collapseRecommended).toBe(true);
    expect(response.intakeBatch?.questions.length).toBeGreaterThan(0);
  });
});
