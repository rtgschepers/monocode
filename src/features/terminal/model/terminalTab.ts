import { basename } from "../../../platform/tauri/fs";
import {
  displayPath,
  isEqualOrInside,
  pathKey,
  projectName,
} from "../../../shared/lib/paths";
import type { FilePaneTab } from "../../workspace/model/layout";

export type TerminalMetaPatch = {
  title?: string;
  cwd?: string;
  /** `null` clears a running command; omit to leave it unchanged. */
  foreground?: string | null;
};

export type RunningTerminal = {
  id: string;
  process: string;
  cwd: string;
  label: string;
  /** Set only for terminals outside the current project. */
  project?: { path: string; name: string };
};

/** Default tab label from the working directory. */
export function defaultTerminalTitle(cwd: string): string {
  const name = basename(cwd);
  if (!name || name === "/") return "Terminal";
  return name;
}

/** Tab label: dynamic title (process or directory) stored on `path`. */
export function terminalTabLabel(file: FilePaneTab): string {
  return file.path?.trim() || defaultTerminalTitle(file.cwd);
}

/** Apply a live PTY title / cwd / foreground patch. */
export function applyTerminalMeta(
  file: FilePaneTab,
  patch: TerminalMetaPatch,
): FilePaneTab {
  if (!file.terminal) return file;
  const path = patch.title ?? file.path;
  const cwd = patch.cwd ?? file.cwd;
  const foreground =
    patch.foreground === undefined
      ? file.foreground
      : (patch.foreground?.trim() || undefined);
  if (
    path === file.path &&
    cwd === file.cwd &&
    foreground === file.foreground
  ) {
    return file;
  }
  return {
    ...file,
    path,
    cwd,
    foreground,
  };
}

/** Terminals whose foreground process is not the shell; `project` marks another one's. */
export function listRunningTerminals(
  files: Iterable<FilePaneTab>,
  project?: string,
): RunningTerminal[] {
  const running: RunningTerminal[] = [];
  for (const file of files) {
    const process = file.foreground?.trim();
    if (!file.terminal || !process) continue;
    running.push({
      id: file.id,
      process,
      cwd: file.cwd,
      label: defaultTerminalTitle(file.cwd),
      ...(project
        ? { project: { path: project, name: projectName(project) } }
        : {}),
    });
  }
  return running;
}

/** Where a running terminal sits; another project's shows its path inside that project. */
export function runningTerminalPlace(terminal: RunningTerminal): string {
  const project = terminal.project;
  if (!project) return terminal.label;
  if (
    pathKey(terminal.cwd) === pathKey(project.path) ||
    !isEqualOrInside(terminal.cwd, project.path)
  )
    return project.name;
  return `${project.name}/${displayPath(terminal.cwd, project.path)}`;
}

/** Status-bar chip copy: `vite`, or `vite · jest`, or `vite ×2`. */
export function runningTerminalChipLabel(terminals: RunningTerminal[]): string {
  if (terminals.length === 0) return "";
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const terminal of terminals) {
    if (!counts.has(terminal.process)) order.push(terminal.process);
    counts.set(terminal.process, (counts.get(terminal.process) ?? 0) + 1);
  }
  return order
    .map((name) => {
      const n = counts.get(name) ?? 1;
      return n > 1 ? `${name} ×${n}` : name;
    })
    .join(" · ");
}

const OSC_CWD =
  /\x1b\]7;file:\/\/[^/]*(\/[^\x07\x1b]*)(?:\x07|\x1b\\)/g;

function decodeOscPath(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Scan PTY output for OSC 7 cwd reports from shell integration. */
export function scanOscCwd(
  chunk: string,
  buffer: string,
): { cwd?: string; rest: string } {
  const merged = buffer + chunk;
  let cwd: string | undefined;
  let last = 0;
  for (const match of merged.matchAll(OSC_CWD)) {
    const index = match.index ?? 0;
    const path = decodeOscPath(match[1] ?? "");
    if (path) cwd = path;
    last = index + match[0].length;
  }
  const tail = merged.slice(last);
  const rest = tail.length > 256 ? tail.slice(-256) : tail;
  return { cwd, rest };
}

/**
 * Working directory for a terminal opened by the general New Terminal
 * commands.
 *
 * A session working in a worktree opens terminals in that worktree, even when
 * the focused pane is a file or terminal from another checkout. Without a
 * worktree, the focused pane's directory wins, then the session's, then
 * `fallback`.
 */
export function newTerminalCwd({
  activeFile,
  session,
  fallback,
}: {
  activeFile?: Pick<FilePaneTab, "cwd">;
  session?: { cwd: string; worktreeCwd?: string; worktreeRemoved?: boolean };
  fallback: string;
}): string {
  if (session?.worktreeCwd && !session.worktreeRemoved)
    return session.worktreeCwd;
  return activeFile?.cwd ?? session?.cwd ?? fallback;
}
