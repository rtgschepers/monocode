// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: async () => () => {} }),
}));
vi.mock("../../../platform/tauri/platform", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../platform/tauri/platform")
  >()),
  IS_MAC: true,
}));

import { Composer } from "./Composer";

it("moves the caret to the line's edges on Home and End", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const modify = vi.fn();
  vi.spyOn(document, "getSelection").mockReturnValue({
    modify,
  } as unknown as Selection);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(Composer, {
          focused: false,
          harness: "codex",
          model: "",
          runtimeMode: "supervised",
          executionCwd: "~",
          initialDraft: "first\nsecond line",
          hideTopBar: true,
          onFocus: vi.fn(),
          onCwdChange: vi.fn(),
          onModelChange: vi.fn(),
          onRuntimeModeChange: vi.fn(),
          onSubmit: vi.fn(),
        }),
      ),
    );
    const textarea = container.querySelector("textarea")!;
    textarea.focus();
    const press = (key: string) => {
      const event = new KeyboardEvent("keydown", {
        key,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        textarea.dispatchEvent(event);
      });
      return event;
    };

    expect(press("Home").defaultPrevented).toBe(true);
    expect(modify).toHaveBeenLastCalledWith(
      "extend",
      "backward",
      "lineboundary",
    );
    expect(press("End").defaultPrevented).toBe(true);
    expect(modify).toHaveBeenLastCalledWith(
      "extend",
      "forward",
      "lineboundary",
    );
  } finally {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
