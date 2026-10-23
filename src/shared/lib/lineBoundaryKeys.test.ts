// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ IS_MAC: true }));
vi.mock("../../platform/tauri/platform", () => platform);

import { handleLineBoundaryKey } from "./lineBoundaryKeys";

const TEXT = "first line\nsecond line\nthird line";

let modify: ReturnType<typeof vi.fn>;

function field() {
  const textarea = document.createElement("textarea");
  textarea.value = TEXT;
  document.body.append(textarea);
  textarea.focus();
  textarea.setSelectionRange(14, 14);
  return textarea;
}

function press(
  textarea: HTMLTextAreaElement,
  key: string,
  modifiers: Partial<
    Pick<KeyboardEvent, "shiftKey" | "altKey" | "metaKey" | "ctrlKey">
  > = {},
  isComposing = false,
) {
  return handleLineBoundaryKey(
    {
      key,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      ctrlKey: false,
      isComposing,
      keyCode: isComposing ? 229 : 0,
      ...modifiers,
    },
    textarea,
  );
}

beforeEach(() => {
  modify = vi.fn();
  vi.spyOn(document, "getSelection").mockReturnValue({
    modify,
  } as unknown as Selection);
});

afterEach(() => {
  platform.IS_MAC = true;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("handleLineBoundaryKey", () => {
  it("moves to the visual line's start and end", () => {
    const textarea = field();
    expect(press(textarea, "Home")).toBe(true);
    expect(modify).toHaveBeenLastCalledWith("move", "backward", "lineboundary");
    expect(press(textarea, "End")).toBe(true);
    expect(modify).toHaveBeenLastCalledWith("move", "forward", "lineboundary");
  });

  it("extends the selection with Shift", () => {
    const textarea = field();
    press(textarea, "End", { shiftKey: true });
    expect(modify).toHaveBeenLastCalledWith(
      "extend",
      "forward",
      "lineboundary",
    );
  });

  it("goes to the whole value's edges with Cmd or Ctrl", () => {
    const textarea = field();
    press(textarea, "Home", { metaKey: true, shiftKey: true });
    expect(modify).toHaveBeenLastCalledWith(
      "extend",
      "backward",
      "documentboundary",
    );
    press(textarea, "End", { ctrlKey: true });
    expect(modify).toHaveBeenLastCalledWith(
      "move",
      "forward",
      "documentboundary",
    );
  });

  it("leaves other keys, Alt combos and IME composition alone", () => {
    const textarea = field();
    expect(press(textarea, "ArrowLeft")).toBe(false);
    expect(press(textarea, "Home", { altKey: true })).toBe(false);
    expect(press(textarea, "End", {}, true)).toBe(false);
    expect(modify).not.toHaveBeenCalled();
  });

  it("defers to the default when the field is unfocused or Selection.modify is missing", () => {
    const textarea = field();
    textarea.blur();
    expect(press(textarea, "Home")).toBe(false);
    textarea.focus();
    vi.mocked(document.getSelection).mockReturnValue({} as Selection);
    expect(press(textarea, "Home")).toBe(false);
    expect(modify).not.toHaveBeenCalled();
  });

  it("defers to the platform's own Home and End off macOS", () => {
    platform.IS_MAC = false;
    expect(press(field(), "Home")).toBe(false);
    expect(modify).not.toHaveBeenCalled();
  });

  it("removes its layout mirror after revealing the caret in a scrolled field", () => {
    const textarea = field();
    Object.defineProperty(textarea, "scrollHeight", { value: 200 });
    Object.defineProperty(textarea, "clientHeight", { value: 50 });
    const children = document.body.children.length;
    expect(press(textarea, "End")).toBe(true);
    expect(document.body.children.length).toBe(children);
  });
});
