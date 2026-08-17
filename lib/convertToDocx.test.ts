import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parseMarkdown } from "./parseMarkdown";
import { convertToDocx } from "./convertToDocx";

// End-to-end through the real pipeline (parseMarkdown -> convertToDocx ->
// real .docx bytes), then unzipped and stripped of XML tags — these
// exercise multiple modules together against real output, unlike
// inlineRuns.test.ts's isolated unit tests.
async function docxText(markdown: string): Promise<string> {
  const blob = await convertToDocx(markdown, parseMarkdown);
  const buffer = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) throw new Error("word/document.xml missing from generated .docx");
  const xml = await documentXml.async("string");
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("convertToDocx", () => {
  it("produces a real zip-based .docx blob with the correct mime type", async () => {
    const blob = await convertToDocx("# Hi", parseMarkdown);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const buffer = await blob.arrayBuffer();
    const signature = String.fromCharCode(...new Uint8Array(buffer).slice(0, 2));
    expect(signature).toBe("PK"); // zip file signature
  });

  it("includes heading and paragraph text in the document body", async () => {
    const text = await docxText("# Project Report\n\nSome body text.");
    expect(text).toContain("Project Report");
    expect(text).toContain("Some body text.");
  });

  it("does not drop bold, italic, or inline code text content", async () => {
    const text = await docxText("This is **bold** and *italic* and `code`.");
    expect(text).toContain("bold");
    expect(text).toContain("italic");
    expect(text).toContain("code");
  });

  it("preserves list item text for ordered, unordered, and nested lists", async () => {
    const text = await docxText("- top\n  - nested\n\n1. first\n2. second\n");
    expect(text).toContain("top");
    expect(text).toContain("nested");
    expect(text).toContain("first");
    expect(text).toContain("second");
  });

  it("includes a real numbering definition for ordered lists", async () => {
    const blob = await convertToDocx("1. one\n2. two\n", parseMarkdown);
    const buffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file("word/numbering.xml")).not.toBeNull();
  });

  it("preserves fenced code block content", async () => {
    const text = await docxText("```\nfunction f() { return 1; }\n```");
    expect(text).toContain("function f() { return 1; }");
  });

  it("preserves table header and cell content", async () => {
    const text = await docxText("| A | B |\n| --- | --- |\n| 1 | 2 |\n");
    expect(text).toContain("A");
    expect(text).toContain("B");
    expect(text).toContain("1");
    expect(text).toContain("2");
  });

  it("preserves blockquote text", async () => {
    const text = await docxText("> a quoted line");
    expect(text).toContain("a quoted line");
  });

  it("replaces an image reference with a bracketed placeholder rather than dropping it silently", async () => {
    const text = await docxText("![a chart](https://example.com/chart.png)");
    expect(text).toContain("[image: a chart]");
  });

  it("does not throw and still produces a non-empty file for an empty markdown input", async () => {
    const blob = await convertToDocx("", parseMarkdown);
    expect(blob.size).toBeGreaterThan(0);
  });
});
