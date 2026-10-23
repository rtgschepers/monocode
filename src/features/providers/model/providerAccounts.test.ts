// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  conversationProviderAccountId,
  DEFAULT_PROVIDER_ACCOUNT_ID,
  newProviderAccount,
  providerAccountLabel,
  providerAccountExists,
  providerAccounts,
  removeProviderAccount,
  renameProviderAccount,
  saveProviderAccount,
  selectedProviderAccountId,
  selectProviderAccount,
  providerHasDefaultAccount,
  supportsAccountProfiles,
} from "./providerAccounts";

beforeEach(() => {
  localStorage.clear();
});

describe("provider accounts", () => {
  it("always exposes the provider-owned default account", () => {
    expect(providerAccounts("codex")).toEqual([
      {
        id: DEFAULT_PROVIDER_ACCOUNT_ID,
        provider: "codex",
        label: "Default account",
        isDefault: true,
      },
    ]);
    expect(providerHasDefaultAccount("codex")).toBe(true);
  });

  it("lists no default account for Claude", () => {
    expect(providerHasDefaultAccount("claude")).toBe(false);
    expect(providerAccounts("claude")).toEqual([]);
    expect(providerAccountExists("claude", DEFAULT_PROVIDER_ACCOUNT_ID)).toBe(
      false,
    );
    expect(providerAccountLabel("claude", DEFAULT_PROVIDER_ACCOUNT_ID)).toBe(
      "No account",
    );
    expect(selectedProviderAccountId("claude", "/repo")).toBeUndefined();
    expect(
      conversationProviderAccountId("claude", undefined, "/repo"),
    ).toBeUndefined();
  });

  it("ignores a stored Claude default name and selection", () => {
    localStorage.setItem(
      "monocode.providerAccounts.v1",
      JSON.stringify({
        claude: [{ id: "default", provider: "claude", label: "Primary" }],
      }),
    );
    localStorage.setItem(
      "monocode.providerAccountSelections.v1",
      JSON.stringify({ "/repo": { claude: "default" } }),
    );
    expect(providerAccounts("claude")).toEqual([]);
    expect(selectedProviderAccountId("claude", "/repo")).toBeUndefined();
  });

  it("falls back to a lone Claude profile but never guesses between several", () => {
    saveProviderAccount({
      id: "account-work",
      provider: "claude",
      label: "Work",
    });
    expect(selectedProviderAccountId("claude", "/repo")).toBe("account-work");
    // Legacy conversations ran on the CLI's own login, stored as "default" or nothing.
    expect(conversationProviderAccountId("claude", "default", "/repo")).toBe(
      "account-work",
    );
    expect(conversationProviderAccountId("claude", undefined, "/repo")).toBe(
      "account-work",
    );

    saveProviderAccount({
      id: "account-personal",
      provider: "claude",
      label: "Personal",
    });
    expect(selectedProviderAccountId("claude", "/repo")).toBeUndefined();
    expect(
      conversationProviderAccountId("claude", "default", "/repo"),
    ).toBeUndefined();
    selectProviderAccount("claude", "/repo", "account-personal");
    expect(conversationProviderAccountId("claude", "default", "/repo")).toBe(
      "account-personal",
    );
    expect(
      conversationProviderAccountId("claude", "account-work", "/repo"),
    ).toBe("account-work");
  });

  it("keeps Codex conversations on their default account", () => {
    saveProviderAccount({
      id: "account-work",
      provider: "codex",
      label: "Work",
    });
    expect(selectedProviderAccountId("codex", "/repo")).toBe(
      DEFAULT_PROVIDER_ACCOUNT_ID,
    );
    expect(conversationProviderAccountId("codex", "default", "/repo")).toBe(
      DEFAULT_PROVIDER_ACCOUNT_ID,
    );
    expect(conversationProviderAccountId("codex", undefined, "/repo")).toBe(
      DEFAULT_PROVIDER_ACCOUNT_ID,
    );
  });

  it("lists Devin with only its CLI login and refuses named profiles", () => {
    expect(supportsAccountProfiles("devin")).toBe(false);
    expect(supportsAccountProfiles("codex")).toBe(true);
    saveProviderAccount({ id: "account-work", provider: "devin", label: "Work" });
    // Stale storage from elsewhere is ignored too.
    localStorage.setItem(
      "monocode.providerAccounts.v1",
      JSON.stringify({ devin: [{ id: "account-old", provider: "devin", label: "Old" }] }),
    );
    expect(providerAccounts("devin").map((account) => account.id)).toEqual([
      DEFAULT_PROVIDER_ACCOUNT_ID,
    ]);
    expect(renameProviderAccount("devin", "default", "Personal")?.label).toBe("Personal");
    expect(providerAccountLabel("devin", "default")).toBe("Personal");
  });

  it("stores named profiles separately per provider", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
    const work = newProviderAccount("claude", "  Work   account  ");
    saveProviderAccount(work);

    expect(providerAccounts("claude").map((account) => account.label)).toEqual([
      "Work account",
    ]);
    expect(providerAccounts("codex")).toHaveLength(1);
    expect(providerAccountLabel("claude", work.id)).toBe("Work account");
  });

  it("falls back to the default account for malformed stored profiles", () => {
    localStorage.setItem(
      "monocode.providerAccounts.v1",
      JSON.stringify({ codex: { id: "not-an-array" } }),
    );

    expect(providerAccounts("codex").map((account) => account.id)).toEqual([
      DEFAULT_PROVIDER_ACCOUNT_ID,
    ]);
  });

  it("falls back when the stored root is not a record", () => {
    for (const malformed of ["null", "[]", "42"]) {
      localStorage.setItem("monocode.providerAccounts.v1", malformed);
      expect(providerAccounts("codex").map((account) => account.id)).toEqual([
        DEFAULT_PROVIDER_ACCOUNT_ID,
      ]);
      expect(providerAccounts("claude")).toEqual([]);
    }

    localStorage.setItem("monocode.providerAccountSelections.v1", "null");
    expect(selectedProviderAccountId("codex", "/repo")).toBe(
      DEFAULT_PROVIDER_ACCOUNT_ID,
    );
    expect(selectedProviderAccountId("claude", "/repo")).toBeUndefined();
  });

  it("replaces malformed provider storage when saving an account", () => {
    localStorage.setItem(
      "monocode.providerAccounts.v1",
      JSON.stringify({ codex: "not-an-array" }),
    );

    expect(() =>
      saveProviderAccount({
        id: "account-work",
        provider: "codex",
        label: "Work",
      }),
    ).not.toThrow();
    expect(providerAccounts("codex").map((account) => account.label)).toEqual([
      "Default account",
      "Work",
    ]);
  });

  it("discards malformed account entries when saving an account", () => {
    localStorage.setItem(
      "monocode.providerAccounts.v1",
      JSON.stringify({
        codex: [
          null,
          42,
          { id: "account-missing-label", provider: "codex" },
          { id: "account-keep", provider: "codex", label: "Keep" },
        ],
      }),
    );

    expect(() =>
      saveProviderAccount({
        id: "account-work",
        provider: "codex",
        label: "Work",
      }),
    ).not.toThrow();
    expect(providerAccounts("codex").map((account) => account.label)).toEqual([
      "Default account",
      "Keep",
      "Work",
    ]);
  });

  it("remembers a selection per project and ignores unknown ids", () => {
    const work = {
      id: "account-work",
      provider: "codex" as const,
      label: "Work",
    };
    saveProviderAccount(work);
    selectProviderAccount("codex", "/repo/one", work.id);

    expect(selectedProviderAccountId("codex", "/repo/one")).toBe(work.id);
    expect(selectedProviderAccountId("codex", "/repo/two")).toBe(
      DEFAULT_PROVIDER_ACCOUNT_ID,
    );
    selectProviderAccount("codex", "/repo/one", "missing");
    expect(selectedProviderAccountId("codex", "/repo/one")).toBe(work.id);
  });

  it("renames a named account without changing its identity or order", () => {
    saveProviderAccount({
      id: "account-work",
      provider: "codex",
      label: "Wrk",
    });
    saveProviderAccount({
      id: "account-personal",
      provider: "codex",
      label: "Personal",
    });

    expect(
      renameProviderAccount("codex", "account-work", "  Work   account  "),
    ).toEqual({
      id: "account-work",
      provider: "codex",
      label: "Work account",
    });
    expect(providerAccounts("codex").map((account) => account.id)).toEqual([
      DEFAULT_PROVIDER_ACCOUNT_ID,
      "account-work",
      "account-personal",
    ]);
  });

  it("removes named account metadata and every project selection", () => {
    const work = {
      id: "account-work",
      provider: "claude" as const,
      label: "Work",
    };
    saveProviderAccount(work);
    selectProviderAccount("claude", "/repo/one", work.id);
    selectProviderAccount("claude", "/repo/two", work.id);

    expect(removeProviderAccount("claude", work.id)).toBe(true);
    expect(providerAccountExists("claude", work.id)).toBe(false);
    expect(selectedProviderAccountId("claude", "/repo/one")).toBeUndefined();
    expect(selectedProviderAccountId("claude", "/repo/two")).toBeUndefined();
  });

  it("renames but does not remove the provider-owned default account", () => {
    expect(renameProviderAccount("codex", "default", "  Personal  ")).toEqual({
      id: DEFAULT_PROVIDER_ACCOUNT_ID,
      provider: "codex",
      label: "Personal",
      isDefault: true,
    });
    expect(removeProviderAccount("codex", "default")).toBe(false);
    expect(providerAccounts("codex")[0]?.label).toBe("Personal");
  });

  it("preserves a custom default name when named profiles change", () => {
    renameProviderAccount("codex", "default", "Primary");
    saveProviderAccount({
      id: "account-work",
      provider: "codex",
      label: "Work",
    });
    removeProviderAccount("codex", "account-work");

    expect(providerAccounts("codex")[0]?.label).toBe("Primary");
  });
});
