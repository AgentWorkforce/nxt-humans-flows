// Two step verbs this flow uses that land in the next relayflows release.
// Both lower to `llm` steps with a structured output gate; they are declared
// here so the flow typechecks today. Delete this file once
// @relayflows/surface ships them.
import type { Step } from "@relayflows/surface";

/** A judge's verdict on one rubric. */
export interface Verdict {
  pass: boolean;
  /** 0–1: how well the input meets the rubric. */
  score: number;
  /** What the judge found, one sentence each; empty on a clean pass. */
  findings: string[];
}

/** A classifier's choice of exactly one label. */
export interface Classification<L extends string> {
  label: L;
  reason: string;
}

declare module "@relayflows/surface" {
  interface Ctx {
    /** Judge `input` against a rubric; passes at or above `threshold` (default 0.8). */
    judge(name: string, options: { input: unknown; rubric: string; threshold?: number }): Step<Verdict>;
    /** Pick exactly one of `labels` (label → when it applies) for `input`. */
    classify<L extends string>(name: string, options: { input: unknown; labels: Record<L, string> }): Step<Classification<L>>;
  }
}
