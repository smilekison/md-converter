import { describe, expect, it } from "vitest";
import type { PhrasingContent } from "mdast";
import { extractInlineRuns, flattenToText } from "./inlineRuns";

// Hand-built mdast nodes rather than going through the real parser — these
// are unit tests of the run-extraction logic in isolation; parseMarkdown's
// own output shape is covered separately in parseMarkdown.test.ts.
function text(value: string): PhrasingContent {
  return { type: "text", value };
}

describe("extractInlineRuns", () => {
  it("passes plain text through unstyled", () => {
    const runs = extractInlineRuns([text("hello world")]);
    expect(runs).toEqual([{ text: "hello world", bold: false, italic: false, strike: false, code: false }]);
  });

  it("marks strong text as bold", () => {
    const runs = extractInlineRuns([{ type: "strong", children: [text("bold")] }]);
    expect(runs[0]).toMatchObject({ text: "bold", bold: true, italic: false });
  });

  it("marks emphasis as italic", () => {
    const runs = extractInlineRuns([{ type: "emphasis", children: [text("italic")] }]);
    expect(runs[0]).toMatchObject({ text: "italic", italic: true, bold: false });
  });

  it("combines nested bold-inside-italic into a single run with both flags", () => {
    const runs = extractInlineRuns([{ type: "emphasis", children: [{ type: "strong", children: [text("both")] }] }]);
    expect(runs).toEqual([{ text: "both", bold: true, italic: true, strike: false, code: false }]);
  });

  it("marks delete as strikethrough", () => {
    const runs = extractInlineRuns([{ type: "delete", children: [text("gone")] }]);
    expect(runs[0]).toMatchObject({ text: "gone", strike: true });
  });

  it("marks inlineCode as code", () => {
    const runs = extractInlineRuns([{ type: "inlineCode", value: "const x = 1" }]);
    expect(runs).toEqual([{ text: "const x = 1", bold: false, italic: false, strike: false, code: true }]);
  });

  it("attaches the link url to every run inside a link, preserving inner styling", () => {
    const runs = extractInlineRuns([
      { type: "link", url: "https://example.com", children: [text("plain "), { type: "strong", children: [text("bold")] }] },
    ]);
    expect(runs).toEqual([
      { text: "plain ", bold: false, italic: false, strike: false, code: false, link: "https://example.com" },
      { text: "bold", bold: true, italic: false, strike: false, code: false, link: "https://example.com" },
    ]);
  });

  it("renders an inline image as a bracketed text placeholder rather than embedding it", () => {
    const runs = extractInlineRuns([{ type: "image", url: "https://example.com/x.png", alt: "a diagram" }]);
    expect(runs).toEqual([{ text: "[image: a diagram]", bold: false, italic: false, strike: false, code: false }]);
  });

  it("falls back to the url when an image has no alt text", () => {
    const runs = extractInlineRuns([{ type: "image", url: "https://example.com/x.png", alt: null }]);
    expect(runs[0].text).toBe("[image: https://example.com/x.png]");
  });

  it("converts a hard break into a literal newline run", () => {
    const runs = extractInlineRuns([text("line one"), { type: "break" }, text("line two")]);
    expect(runs.map((r) => r.text)).toEqual(["line one", "\n", "line two"]);
  });

  it("drops unsupported node types (e.g. raw html) instead of emitting them", () => {
    const runs = extractInlineRuns([text("before "), { type: "html", value: "<script>evil()</script>" } as unknown as PhrasingContent, text(" after")]);
    expect(runs.map((r) => r.text)).toEqual(["before ", " after"]);
  });

  it("returns an empty array for undefined input", () => {
    expect(extractInlineRuns(undefined)).toEqual([]);
  });
});

describe("flattenToText", () => {
  it("joins styled runs into one plain string", () => {
    const nodes: PhrasingContent[] = [text("Hello, "), { type: "strong", children: [text("world")] }, text("!")];
    expect(flattenToText(nodes)).toBe("Hello, world!");
  });

  it("returns an empty string for undefined input", () => {
    expect(flattenToText(undefined)).toBe("");
  });
});
