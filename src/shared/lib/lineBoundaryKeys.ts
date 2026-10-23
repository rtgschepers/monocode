import { IS_MAC } from "../../platform/tauri/platform";
import { isImeComposition } from "./keyboard";

type LineBoundaryKeyEvent = Pick<
  KeyboardEvent,
  | "key"
  | "shiftKey"
  | "altKey"
  | "metaKey"
  | "ctrlKey"
  | "isComposing"
  | "keyCode"
>;

// Styles that decide where text wraps, so the mirror lays the draft out like the field.
const MIRRORED_STYLES = [
  "direction",
  "font-family",
  "font-feature-settings",
  "font-size",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "letter-spacing",
  "line-height",
  "overflow-wrap",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "tab-size",
  "text-indent",
  "text-transform",
  "white-space",
  "word-break",
  "word-spacing",
];

/** Gives Home/End the caret moves of Cmd+Left/Right; returns true when the caller should preventDefault. */
export function handleLineBoundaryKey(
  event: LineBoundaryKeyEvent,
  field: HTMLTextAreaElement,
): boolean {
  // macOS binds Home/End to document scrolling, which never moves the caret.
  if (!IS_MAC) return false;
  if (event.key !== "Home" && event.key !== "End") return false;
  if (event.altKey || isImeComposition(event)) return false;
  const selection = field.ownerDocument.getSelection();
  if (
    typeof selection?.modify !== "function" ||
    field.ownerDocument.activeElement !== field
  ) {
    return false;
  }
  const forward = event.key === "End";
  // WebKit moves the focused field's caret along the wrapped line, growing a Shift selection like Cmd+Shift+Arrow.
  selection.modify(
    event.shiftKey ? "extend" : "move",
    forward ? "forward" : "backward",
    event.metaKey || event.ctrlKey ? "documentboundary" : "lineboundary",
  );
  revealOffset(field, forward ? field.selectionEnd : field.selectionStart);
  return true;
}

// A scripted selection change does not scroll the field to it, unlike a native caret move.
function revealOffset(field: HTMLTextAreaElement, offset: number) {
  if (field.scrollHeight <= field.clientHeight) return;
  const { top, bottom } = lineBox(field, offset);
  if (top < field.scrollTop) field.scrollTop = top;
  else if (bottom > field.scrollTop + field.clientHeight) {
    field.scrollTop = bottom - field.clientHeight;
  }
}

// Lays the draft out in a hidden copy of the field to find the line holding the offset, padding included.
function lineBox(field: HTMLTextAreaElement, offset: number) {
  const style = getComputedStyle(field);
  const mirror = field.ownerDocument.createElement("div");
  for (const name of MIRRORED_STYLES) {
    mirror.style.setProperty(name, style.getPropertyValue(name));
  }
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const paddingX =
    (parseFloat(style.paddingLeft) || 0) +
    (parseFloat(style.paddingRight) || 0);
  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    boxSizing: "content-box",
    border: "0",
    width: `${field.clientWidth - paddingX}px`,
  });
  mirror.textContent = field.value.slice(0, offset);
  const marker = field.ownerDocument.createElement("span");
  marker.textContent = "\u200b";
  // Top-aligned and line-tall, so the marker covers the whole line box rather than just its glyphs.
  Object.assign(marker.style, {
    display: "inline-block",
    verticalAlign: "top",
    height: style.lineHeight,
  });
  mirror.append(marker);
  field.ownerDocument.body.append(mirror);
  const top = marker.offsetTop - paddingTop;
  const bottom = marker.offsetTop + marker.offsetHeight + paddingBottom;
  mirror.remove();
  return { top, bottom };
}
