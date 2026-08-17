import { describe, expect, it } from "vitest";
import type { Blockquote, List, ListItem, Paragraph, Table } from "mdast";
import { parseMarkdown, renderPreviewHtml } from "./parseMarkdown";

describe("parseMarkdown", () => {
  it("parses a heading into a heading node with the right depth", () => {
    const tree = parseMarkdown("## Section Title");
    expect(tree.children[0]).toMatchObject({ type: "heading", depth: 2 });
  });

  it("parses a fenced code block with its language tag", () => {
    const tree = parseMarkdown("```js\nconst x = 1;\n```");
    expect(tree.children[0]).toMatchObject({ type: "code", lang: "js", value: "const x = 1;" });
  });

  it("parses a GFM table (requires remark-gfm) into a table node with rows", () => {
    const tree = parseMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |\n");
    const table = tree.children[0] as Table;
    expect(table.type).toBe("table");
    expect(table.children).toHaveLength(2); // header row + one body row
    expect(table.children[0].children).toHaveLength(2); // two cells
  });

  it("parses a GFM task list item with its checked state", () => {
    const tree = parseMarkdown("- [x] done\n- [ ] not done\n");
    const list = tree.children[0] as List;
    expect((list.children[0] as ListItem).checked).toBe(true);
    expect((list.children[1] as ListItem).checked).toBe(false);
  });

  it("parses an ordered list with its start number", () => {
    const tree = parseMarkdown("5. five\n6. six\n");
    expect(tree.children[0]).toMatchObject({ type: "list", ordered: true, start: 5 });
  });

  it("parses nested lists as a list node inside a listItem", () => {
    const tree = parseMarkdown("- outer\n  - inner\n");
    const outerList = tree.children[0] as List;
    const outerItem = outerList.children[0] as ListItem;
    const nested = outerItem.children.find((c): c is List => c.type === "list");
    expect(nested).toBeDefined();
    const innerItem = nested!.children[0] as ListItem;
    const innerParagraph = innerItem.children[0] as Paragraph;
    expect((innerParagraph.children[0] as { value: string }).value).toBe("inner");
  });

  it("parses a blockquote as a blockquote node wrapping a paragraph", () => {
    const tree = parseMarkdown("> quoted text");
    expect(tree.children[0]).toMatchObject({ type: "blockquote" });
    const blockquote = tree.children[0] as Blockquote;
    expect(blockquote.children[0].type).toBe("paragraph");
  });

  it("parses strikethrough (GFM) into a delete node", () => {
    const tree = parseMarkdown("~~gone~~");
    const paragraph = tree.children[0] as Paragraph;
    expect(paragraph.children[0].type).toBe("delete");
  });
});

describe("renderPreviewHtml", () => {
  it("renders a heading to real HTML", async () => {
    const html = await renderPreviewHtml("# Title");
    expect(html).toContain("<h1>Title</h1>");
  });

  it("strips the executable <script> element itself, leaving only inert text behind", async () => {
    // rehype-sanitize removes the tag (so nothing can execute) but, like a
    // real sanitizer, doesn't need to hide the now-inert leftover text —
    // the security property under test is "no <script> tag survives".
    const html = await renderPreviewHtml("Hello <script>alert(1)</script> world");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("</script>");
  });

  it("preserves a normal link as a real anchor tag", async () => {
    const html = await renderPreviewHtml("[click me](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain(">click me<");
  });
});
