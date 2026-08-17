import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseMarkdown } from "./parseMarkdown";
import { convertToPdf } from "./convertToPdf";

type TextItem = { str: string };

// End-to-end through the real pipeline (parseMarkdown -> convertToPdf ->
// real PDF bytes), then decoded page-by-page with pdfjs-dist and
// whitespace-normalized — pdfjs frequently splits one drawn line into
// several text items, so exact spacing between words isn't asserted.
async function pdfPageTexts(markdown: string): Promise<string[]> {
  const blob = await convertToPdf(markdown, parseMarkdown);
  const buffer = await blob.arrayBuffer();
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const raw = (content.items as TextItem[]).map((item) => item.str).join(" ");
    pages.push(raw.replace(/\s+/g, " ").trim());
  }
  return pages;
}

describe("convertToPdf", () => {
  it("produces a real PDF blob with the correct mime type and file signature", async () => {
    const blob = await convertToPdf("# Hi", parseMarkdown);
    expect(blob.type).toBe("application/pdf");
    const buffer = await blob.arrayBuffer();
    const header = new TextDecoder().decode(new Uint8Array(buffer).slice(0, 5));
    expect(header).toBe("%PDF-");
  });

  it("includes heading and paragraph text on the first page", async () => {
    const [page1] = await pdfPageTexts("# Project Report\n\nSome body text.");
    expect(page1).toContain("Project Report");
    expect(page1).toContain("Some body text.");
  });

  it("word-wraps a long paragraph without dropping any words", async () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`);
    const [page1] = await pdfPageTexts(words.join(" "));
    for (const w of ["word0", "word40", "word79"]) expect(page1).toContain(w);
  });

  it("preserves list item text, including nested and task-list items", async () => {
    const [page1] = await pdfPageTexts("- top\n  - nested\n- [x] done\n- [ ] todo\n");
    expect(page1).toContain("top");
    expect(page1).toContain("nested");
    expect(page1).toContain("[x]");
    expect(page1).toContain("[ ]");
  });

  it("preserves ordered list numbering", async () => {
    const [page1] = await pdfPageTexts("5. five\n6. six\n");
    expect(page1).toContain("5.");
    expect(page1).toContain("six");
  });

  it("preserves fenced code block content", async () => {
    const [page1] = await pdfPageTexts("```\nfunction f() { return 1; }\n```");
    expect(page1).toContain("function f() {");
    expect(page1).toContain("return 1; }");
  });

  it("preserves table content rendered via jspdf-autotable", async () => {
    const [page1] = await pdfPageTexts("| Feature | Status |\n| --- | --- |\n| PDF export | Done |\n");
    expect(page1).toContain("Feature");
    expect(page1).toContain("Status");
    expect(page1).toContain("PDF export");
    expect(page1).toContain("Done");
  });

  it("preserves blockquote text", async () => {
    const [page1] = await pdfPageTexts("> a quoted line");
    expect(page1).toContain("a quoted line");
  });

  it("replaces an image reference with a bracketed placeholder", async () => {
    const [page1] = await pdfPageTexts("![a chart](https://example.com/chart.png)");
    expect(page1).toContain("[image: a chart]");
  });

  it("spills onto additional pages once content exceeds one page", async () => {
    const longDoc = Array.from({ length: 100 }, (_, i) => `## Section ${i}\n\nSome paragraph text for section number ${i}.\n`).join("\n");
    const pages = await pdfPageTexts(longDoc);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0]).toContain("Section 0");
    expect(pages[pages.length - 1]).toContain(`Section 99`);
  });

  it("does not throw and still produces a non-empty file for an empty markdown input", async () => {
    const blob = await convertToPdf("", parseMarkdown);
    expect(blob.size).toBeGreaterThan(0);
  });
});
