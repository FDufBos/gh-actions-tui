export type CheckCategory =
  | "running"
  | "queued"
  | "pending"
  | "failed"
  | "cancelled"
  | "passed"
  | "skipped";

export const DISPLAY_ORDER: CheckCategory[] = [
  "running",
  "queued",
  "pending",
  "failed",
  "cancelled",
  "passed",
  "skipped",
];

export type PullRequest = {
  number: number;
  title: string;
  url: string;
  owner: string;
  repo: string;
  headSha: string;
  draft: boolean;
  updatedAt: Date;
};

export type Check = {
  name: string;
  source: string;
  url: string;
  status: string;
  conclusion: string;
  category: CheckCategory;
  required: boolean;
};

export type WorkflowRun = {
  id: number;
  name: string;
  displayName: string;
  event: string;
  status: string;
  conclusion: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  category: CheckCategory;
};

export type AppConfig = {
  repos: string[];
  refreshSeconds: number;
};

export type ReviewDecision = "APPROVED" | "REVIEW_REQUIRED" | "CHANGES_REQUESTED" | "UNKNOWN";
