import { describe, expect, it } from "vitest";
import { newTerminalFile } from "../../workspace/model/layout";
import {
  applyTerminalMeta,
  defaultTerminalTitle,
  listRunningTerminals,
  newTerminalCwd,
  runningTerminalChipLabel,
  runningTerminalPlace,
  scanOscCwd,
  terminalTabLabel,
} from "./terminalTab";

describe("defaultTerminalTitle", () => {
  it("uses the directory basename", () => {
    expect(defaultTerminalTitle("/Users/dev/agent-terminal")).toBe(
      "agent-terminal",
    );
    expect(defaultTerminalTitle("/")).toBe("Terminal");
  });
});

describe("terminalTabLabel", () => {
  it("prefers the dynamic title on the tab", () => {
    const file = newTerminalFile("/repo", "npm");
    expect(terminalTabLabel(file)).toBe("npm");
  });
});

describe("applyTerminalMeta", () => {
  it("records a foreground process and clears it", () => {
    const file = newTerminalFile("/repo", "repo");
    const running = applyTerminalMeta(file, {
      title: "vite",
      foreground: "vite",
    });
    expect(running).toMatchObject({ path: "vite", foreground: "vite" });
    expect(running).not.toBe(file);

    const idle = applyTerminalMeta(running, {
      title: "repo",
      foreground: null,
    });
    expect(idle.path).toBe("repo");
    expect(idle.foreground).toBeUndefined();
  });

  it("returns the same object when nothing changes", () => {
    const file = applyTerminalMeta(newTerminalFile("/repo", "vite"), {
      foreground: "vite",
    });
    expect(applyTerminalMeta(file, { foreground: "vite" })).toBe(file);
  });
});

describe("listRunningTerminals", () => {
  it("skips idle shells", () => {
    const idle = newTerminalFile("/repo");
    const running = applyTerminalMeta(newTerminalFile("/repo", "dev"), {
      foreground: "vite",
    });
    expect(listRunningTerminals([idle, running])).toEqual([
      {
        id: running.id,
        process: "vite",
        cwd: "/repo",
        label: "repo",
      },
    ]);
  });

  it("names the project of terminals outside the current one", () => {
    const running = applyTerminalMeta(newTerminalFile("/work/shop/web"), {
      foreground: "vite",
    });
    expect(listRunningTerminals([running], "/work/shop")).toEqual([
      {
        id: running.id,
        process: "vite",
        cwd: "/work/shop/web",
        label: "web",
        project: { path: "/work/shop", name: "shop" },
      },
    ]);
  });
});

describe("runningTerminalPlace", () => {
  const base = { id: "a", process: "vite", cwd: "/work/shop", label: "shop" };
  const project = { path: "/work/shop", name: "shop" };
  const at = (cwd: string) => ({ ...base, cwd, label: "x", project });

  it("shows the folder for the current project", () => {
    expect(runningTerminalPlace(base)).toBe("shop");
  });

  it("shows another project's terminal by its path inside that project", () => {
    expect(runningTerminalPlace(at("/work/shop"))).toBe("shop");
    expect(runningTerminalPlace(at("/work/shop/packages/web"))).toBe(
      "shop/packages/web",
    );
  });

  it("shows just the project name once the shell leaves it", () => {
    expect(runningTerminalPlace(at("/tmp"))).toBe("shop");
    expect(runningTerminalPlace(at("/work/shopfront"))).toBe("shop");
  });
});

describe("runningTerminalChipLabel", () => {
  it("joins unique names and collapses duplicates", () => {
    expect(
      runningTerminalChipLabel([
        { id: "a", process: "vite", cwd: "/a", label: "a" },
        { id: "b", process: "jest", cwd: "/b", label: "b" },
      ]),
    ).toBe("vite · jest");
    expect(
      runningTerminalChipLabel([
        { id: "a", process: "vite", cwd: "/a", label: "a" },
        { id: "b", process: "vite", cwd: "/b", label: "b" },
      ]),
    ).toBe("vite ×2");
  });

  it("keeps project names out of the label", () => {
    expect(
      runningTerminalChipLabel([
        { id: "a", process: "jest", cwd: "/a", label: "a" },
        {
          id: "b",
          process: "vite",
          cwd: "/b",
          label: "b",
          project: { path: "/b", name: "b" },
        },
      ]),
    ).toBe("jest · vite");
  });
});

describe("scanOscCwd", () => {
  it("extracts cwd from OSC 7 reports", () => {
    const chunk = "\x1b]7;file://host/Users/dev/repo\x07";
    const { cwd, rest } = scanOscCwd(chunk, "");
    expect(cwd).toBe("/Users/dev/repo");
    expect(rest).toBe("");
  });

  it("keeps a trailing buffer for split sequences", () => {
    const partial = "\x1b]7;file://host/Users/dev";
    const { cwd, rest } = scanOscCwd("/repo\x07", partial);
    expect(cwd).toBe("/Users/dev/repo");
    expect(rest).toBe("");
  });
});

describe("newTerminalCwd", () => {
  const worktreeSession = {
    cwd: "/repo",
    worktreeCwd: "/repo/.worktrees/feature",
  };

  it("opens in the session's worktree over a focused main-checkout pane", () => {
    expect(
      newTerminalCwd({
        activeFile: { cwd: "/repo" },
        session: worktreeSession,
        fallback: "/repo",
      }),
    ).toBe("/repo/.worktrees/feature");
  });

  it("keeps the focused pane's directory for a session without a worktree", () => {
    expect(
      newTerminalCwd({
        activeFile: { cwd: "/repo/packages/app" },
        session: { cwd: "/repo" },
        fallback: "/elsewhere",
      }),
    ).toBe("/repo/packages/app");
  });

  it("does not open in a worktree that was removed", () => {
    expect(
      newTerminalCwd({
        activeFile: { cwd: "/repo/docs" },
        session: { ...worktreeSession, worktreeRemoved: true },
        fallback: "/repo",
      }),
    ).toBe("/repo/docs");
    expect(
      newTerminalCwd({
        session: { ...worktreeSession, worktreeRemoved: true },
        fallback: "/elsewhere",
      }),
    ).toBe("/repo");
  });

  it("uses the fallback with no session or focused pane", () => {
    expect(newTerminalCwd({ fallback: "/repo" })).toBe("/repo");
    expect(
      newTerminalCwd({ activeFile: { cwd: "/notes" }, fallback: "/repo" }),
    ).toBe("/notes");
  });
});
