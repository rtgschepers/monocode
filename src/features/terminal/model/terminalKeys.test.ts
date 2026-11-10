import { describe, expect, it } from "vitest";
import {
  isMacTerminalClearShortcut,
  macTerminalShortcutData,
  terminalOwnsCtrlChord,
} from "./terminalKeys";

function key(
  key: string,
  modifiers: Partial<
    Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">
  > = {},
) {
  return {
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  };
}

describe("mac terminal editing shortcuts", () => {
  it("sends shell word movement for Option+Arrow", () => {
    expect(macTerminalShortcutData(key("ArrowLeft", { altKey: true }))).toBe(
      "\x1bb",
    );
    expect(macTerminalShortcutData(key("ArrowRight", { altKey: true }))).toBe(
      "\x1bf",
    );
  });

  it("sends line movement and deletion for Command shortcuts", () => {
    expect(macTerminalShortcutData(key("ArrowLeft", { metaKey: true }))).toBe(
      "\x01",
    );
    expect(macTerminalShortcutData(key("ArrowRight", { metaKey: true }))).toBe(
      "\x05",
    );
    expect(macTerminalShortcutData(key("Backspace", { metaKey: true }))).toBe(
      "\x15",
    );
  });

  it("leaves other modifiers and keys to xterm and app shortcuts", () => {
    expect(
      macTerminalShortcutData(
        key("ArrowLeft", { metaKey: true, altKey: true }),
      ),
    ).toBeNull();
    expect(
      macTerminalShortcutData(
        key("ArrowLeft", { altKey: true, shiftKey: true }),
      ),
    ).toBeNull();
    expect(
      macTerminalShortcutData(key("ArrowLeft", { ctrlKey: true })),
    ).toBeNull();
    expect(
      macTerminalShortcutData(key("Backspace", { altKey: true })),
    ).toBeNull();
    expect(
      macTerminalShortcutData(key("Delete", { metaKey: true })),
    ).toBeNull();
  });
});

describe("mac terminal clear shortcut", () => {
  it("matches Command+K only", () => {
    expect(isMacTerminalClearShortcut(key("k", { metaKey: true }))).toBe(true);
    expect(isMacTerminalClearShortcut(key("K", { metaKey: true }))).toBe(true);
    expect(isMacTerminalClearShortcut(key("k", { ctrlKey: true }))).toBe(false);
    expect(
      isMacTerminalClearShortcut(key("k", { metaKey: true, shiftKey: true })),
    ).toBe(false);
    expect(
      isMacTerminalClearShortcut(key("k", { metaKey: true, altKey: true })),
    ).toBe(false);
    expect(isMacTerminalClearShortcut(key("j", { metaKey: true }))).toBe(false);
  });
});

describe("terminalOwnsCtrlChord", () => {
  const inTerminal = {
    closest: (selector: string) =>
      selector === ".monocode-terminal" ? {} : null,
  } as unknown as EventTarget;
  const elsewhere = { closest: () => null } as unknown as EventTarget;
  const chord = (
    target: EventTarget | null,
    modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {},
  ) => ({ ctrlKey: false, metaKey: false, target, ...modifiers });

  it("hands Ctrl chords in a terminal to the program on macOS", () => {
    expect(
      terminalOwnsCtrlChord(chord(inTerminal, { ctrlKey: true }), true),
    ).toBe(true);
  });

  it("keeps Cmd chords for the app, with or without Ctrl", () => {
    expect(
      terminalOwnsCtrlChord(chord(inTerminal, { metaKey: true }), true),
    ).toBe(false);
    expect(
      terminalOwnsCtrlChord(
        chord(inTerminal, { ctrlKey: true, metaKey: true }),
        true,
      ),
    ).toBe(false);
  });

  it("leaves Ctrl to the app off macOS and outside a terminal", () => {
    expect(
      terminalOwnsCtrlChord(chord(inTerminal, { ctrlKey: true }), false),
    ).toBe(false);
    expect(
      terminalOwnsCtrlChord(chord(elsewhere, { ctrlKey: true }), true),
    ).toBe(false);
    expect(terminalOwnsCtrlChord(chord(null, { ctrlKey: true }), true)).toBe(
      false,
    );
  });
});
