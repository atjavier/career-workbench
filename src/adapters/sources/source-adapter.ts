import type { SourceConfiguration } from "@/domain/discovery/source-configurations";

export type SourceAdapterListing = {
  title: string;
  company: string;
  originalUrl: string;
  workStyle?: string;
  location?: string;
  postedAt?: string;
};
export type SourceAdapterResult = {
  status: "completed" | "partial" | "failed" | "blocked" | "throttled";
  httpStatus?: 401 | 403 | 429;
  recoveryGuidance?: string;
  listings?: SourceAdapterListing[];
};
export type SourceAdapterContext = {
  source: SourceConfiguration;
  signal: AbortSignal;
  consumeRequest: () => void;
};
export type SourceAdapter = {
  sourceId: string;
  sourceConfigurationRevisionId: string;
  refresh(context: SourceAdapterContext): Promise<SourceAdapterResult>;
};

export function adapterKey(
  sourceId: string,
  sourceConfigurationRevisionId: string,
): string {
  return `${sourceId}:${sourceConfigurationRevisionId}`;
}

// Production intentionally has no live adapters. A new adapter requires its own recorded policy approval.
export const sourceAdapterRegistry = new Map<string, SourceAdapter>();
