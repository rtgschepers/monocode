import type { HarnessId } from "../../../features/sessions/model/session";
import { isHarnessAvailable } from "./availability";
import {
  providerAccounts,
  selectedProviderAccountId,
} from "../../../features/providers/model/providerAccounts";
import type { PrContent } from "../../../features/source-control/model/gitText";
import {
  generateHarnessCommitMessage,
  generateHarnessPrContent,
  warmupHarnessText,
} from "./registry";

const TEXT_HARNESSES: HarnessId[] = [
  "claude",
  "cursor",
  "codex",
  "grok",
  "opencode",
];

/** Pick the harness used for titles, commit messages, and PR text. */
export function pickTextHarness(
  preferred?: HarnessId,
  cwd?: string,
): HarnessId {
  const ordered =
    preferred && TEXT_HARNESSES.includes(preferred)
      ? [preferred, ...TEXT_HARNESSES.filter((id) => id !== preferred)]
      : TEXT_HARNESSES;
  for (const id of ordered) {
    // Claude runs only on a named profile, so without one another CLI writes the text.
    if (id === "claude" && !claudeTextAccount(cwd)) continue;
    if (isHarnessAvailable(id)) return id;
  }
  return preferred && TEXT_HARNESSES.includes(preferred) ? preferred : "cursor";
}

/** Claude text runs on `cwd`'s profile, so several profiles and no pick there leave it none. */
function claudeTextAccount(cwd: string | undefined): boolean {
  return cwd === undefined
    ? providerAccounts("claude").length > 0
    : selectedProviderAccountId("claude", cwd) !== undefined;
}

export function warmupText(cwd: string, preferred?: HarnessId): Promise<void> {
  return warmupHarnessText(pickTextHarness(preferred, cwd), cwd);
}

export function generateCommitMessage(
  cwd: string,
  preferred?: HarnessId,
  signal?: AbortSignal,
  paths?: readonly string[],
): Promise<string> {
  return generateHarnessCommitMessage(pickTextHarness(preferred, cwd), cwd, signal, paths);
}

export function generatePrContent(
  cwd: string,
  preferred?: HarnessId,
): Promise<(PrContent & { base: string; head: string }) | null> {
  return generateHarnessPrContent(pickTextHarness(preferred, cwd), cwd);
}
