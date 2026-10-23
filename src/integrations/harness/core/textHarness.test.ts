// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./availability", () => ({ isHarnessAvailable: () => true }));
vi.mock("./registry", () => ({
  generateHarnessCommitMessage: vi.fn(),
  generateHarnessPrContent: vi.fn(),
  warmupHarnessText: vi.fn(),
}));

import { pickTextHarness } from "./textHarness";
import {
  saveProviderAccount,
  selectProviderAccount,
} from "../../../features/providers/model/providerAccounts";

beforeEach(() => {
  localStorage.clear();
});

describe("pickTextHarness", () => {
  it("passes over Claude until it has a profile", () => {
    expect(pickTextHarness()).toBe("cursor");
    expect(pickTextHarness("claude")).toBe("cursor");
    expect(pickTextHarness("codex")).toBe("codex");

    saveProviderAccount({
      id: "account-work",
      provider: "claude",
      label: "Work",
    });
    expect(pickTextHarness()).toBe("claude");
    expect(pickTextHarness("claude")).toBe("claude");
  });

  it("passes over Claude in a folder with several profiles and no pick", () => {
    saveProviderAccount({
      id: "account-work",
      provider: "claude",
      label: "Work",
    });
    saveProviderAccount({
      id: "account-personal",
      provider: "claude",
      label: "Personal",
    });
    expect(pickTextHarness("claude")).toBe("claude");
    expect(pickTextHarness("claude", "/repo")).toBe("cursor");

    selectProviderAccount("claude", "/repo", "account-work");
    expect(pickTextHarness("claude", "/repo")).toBe("claude");
  });
});
