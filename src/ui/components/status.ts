import type { CheckCategory, ReviewDecision } from "../../domain/types";
import { colors } from "../theme";

/** Filled-circle indicator used for every status dot in the UI. */
export function statusToken(_category: CheckCategory): string {
  return "●";
}

/** Map a check/run category to its theme colour. */
export function statusColor(category: CheckCategory): string {
  switch (category) {
    case "running":
    case "queued":
    case "pending":
      return colors.yellow;
    case "passed":
      return colors.green;
    case "failed":
      return colors.red;
    default:
      return colors.dim;
  }
}

/** Map a review decision to its theme colour. */
export function reviewColor(value: ReviewDecision): string {
  switch (value) {
    case "APPROVED":
      return colors.green;
    case "CHANGES_REQUESTED":
      return colors.red;
    case "REVIEW_REQUIRED":
      return colors.yellow;
    default:
      return colors.dim;
  }
}

/** Human-readable review label with a leading icon. */
export function reviewLabel(value: ReviewDecision): string {
  switch (value) {
    case "APPROVED":
      return "Approved \u221A";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "REVIEW_REQUIRED":
      return "Review required";
    default:
      return "";
  }
}
