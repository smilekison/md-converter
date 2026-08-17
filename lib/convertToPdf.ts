import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { List, ListItem, PhrasingContent, Root, RootContent } from "mdast";
import { extractInlineRuns, flattenToText, type InlineRun } from "./inlineRuns";

type Cursor = {
  doc: jsPDF;
  y: number;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
};

// Always call before drawing a line: pre-checks whether the line fits on
// the current page and starts a fresh page first if not, so no line is
// ever drawn only to discover afterward that it overflowed.
function advanceLine(c: Cursor, lineHeight: number) {
  if (c.y + lineHeight > c.pageHeight - c.margin) {
    c.doc.addPage();
    c.y = c.margin;
  }
  c.y += lineHeight;
}

function setFontFor(c: Cursor, run: InlineRun, size: number) {
  const family = run.code ? "courier" : "helvetica";
  const style = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
  c.doc.setFont(family, style);
  c.doc.setFontSize(size);
  if (run.link) c.doc.setTextColor(17, 85, 204);
  else if (run.code) c.doc.setTextColor(173, 20, 56);
  else c.doc.setTextColor(20, 20, 20);
}

type Token = { text: string; run: InlineRun } | { lineBreak: true };

function tokenize(runs: InlineRun[]): Token[] {
  const tokens: Token[] = [];
  for (const run of runs) {
    if (run.text === "\n") {
      tokens.push({ lineBreak: true });
      continue;
    }
    for (const word of run.text.split(/\s+/).filter(Boolean)) {
      tokens.push({ text: word, run });
    }
  }
  return tokens;
}

// Word-wraps a run of mixed-style inline text (bold/italic/code/links)
// across as many lines as needed, breaking pages when a line won't fit.
// Trades a hanging indent on wrapped lines for a much simpler, still
// visually correct, single left edge per paragraph.
function layoutRuns(c: Cursor, runs: InlineRun[], opts: { fontSize: number; x: number; maxWidth: number; lineHeight: number }) {
  const { fontSize, x, maxWidth, lineHeight } = opts;
  const tokens = tokenize(runs);
  if (tokens.length === 0) {
    advanceLine(c, lineHeight);
    return;
  }
  let cursorX = x;
  let firstOnLine = true;
  advanceLine(c, lineHeight);
  for (const token of tokens) {
    if ("lineBreak" in token) {
      advanceLine(c, lineHeight);
      cursorX = x;
      firstOnLine = true;
      continue;
    }
    setFontFor(c, token.run, fontSize);
    const wordWidth = c.doc.getTextWidth(token.text);
    const spaceWidth = c.doc.getTextWidth(" ");
    const needed = cursorX + (firstOnLine ? 0 : spaceWidth) + wordWidth;
    if (!firstOnLine && needed > x + maxWidth) {
      advanceLine(c, lineHeight);
      cursorX = x;
      firstOnLine = true;
    }
    if (!firstOnLine) cursorX += spaceWidth;
    if (token.run.link) {
      c.doc.textWithLink(token.text, cursorX, c.y, { url: token.run.link });
    } else {
      c.doc.text(token.text, cursorX, c.y);
    }
    if (token.run.strike) {
      c.doc.setDrawColor(20, 20, 20);
      c.doc.setLineWidth(0.6);
      c.doc.line(cursorX, c.y - fontSize * 0.32, cursorX + wordWidth, c.y - fontSize * 0.32);
    }
    cursorX += wordWidth;
    firstOnLine = false;
  }
}

function renderCodeBlock(c: Cursor, code: string) {
  const fontSize = 9.5;
  const lineHeight = 13;
  c.doc.setFont("courier", "normal");
  c.doc.setFontSize(fontSize);
  const lines: string[] = [];
  for (const raw of code.split("\n")) {
    const wrapped = c.doc.splitTextToSize(raw.length ? raw : " ", c.contentWidth - 16) as string[];
    lines.push(...(wrapped.length ? wrapped : [""]));
  }
  for (const line of lines) {
    advanceLine(c, lineHeight);
    c.doc.setFillColor(245, 245, 245);
    c.doc.rect(c.margin, c.y - lineHeight + 3, c.contentWidth, lineHeight, "F");
    c.doc.setFont("courier", "normal");
    c.doc.setFontSize(fontSize);
    c.doc.setTextColor(50, 50, 50);
    c.doc.text(line, c.margin + 8, c.y);
  }
}

function renderList(c: Cursor, node: List, level: number) {
  let index = node.start ?? 1;
  for (const item of node.children as ListItem[]) {
    const indent = c.margin + level * 18;
    const marker = typeof item.checked === "boolean" ? (item.checked ? "[x]" : "[ ]") : node.ordered ? `${index}.` : "-";
    index++;
    const firstBlock = item.children.find((child) => child.type !== "list");
    const innerRuns = firstBlock && "children" in firstBlock ? extractInlineRuns((firstBlock as { children: PhrasingContent[] }).children) : [];
    const runs: InlineRun[] = [{ text: marker, bold: false, italic: false, strike: false, code: false }, ...innerRuns];
    layoutRuns(c, runs, { fontSize: 11, x: indent, maxWidth: c.contentWidth - (indent - c.margin), lineHeight: 15 });
    for (const child of item.children) {
      if (child.type === "list") renderList(c, child as List, level + 1);
    }
  }
}

function renderBlocks(c: Cursor, nodes: RootContent[]) {
  const headingSizes = [22, 18, 15, 13, 12, 11];

  for (const node of nodes) {
    switch (node.type) {
      case "heading": {
        const size = headingSizes[Math.min(node.depth - 1, 5)];
        const runs = extractInlineRuns(node.children).map((r) => ({ ...r, bold: true }));
        layoutRuns(c, runs, { fontSize: size, x: c.margin, maxWidth: c.contentWidth, lineHeight: size * 1.3 });
        c.y += 6;
        break;
      }
      case "paragraph": {
        layoutRuns(c, extractInlineRuns(node.children), { fontSize: 11, x: c.margin, maxWidth: c.contentWidth, lineHeight: 15 });
        c.y += 8;
        break;
      }
      case "list": {
        renderList(c, node, 0);
        c.y += 4;
        break;
      }
      case "blockquote": {
        const startY = c.y;
        const x = c.margin + 18;
        for (const child of node.children) {
          if (child.type === "paragraph") {
            const runs = extractInlineRuns(child.children).map((r) => ({ ...r, italic: true }));
            layoutRuns(c, runs, { fontSize: 11, x, maxWidth: c.contentWidth - 18, lineHeight: 15 });
          } else {
            renderBlocks(c, [child]);
          }
        }
        c.doc.setDrawColor(200, 200, 200);
        c.doc.setLineWidth(2);
        c.doc.line(c.margin + 6, startY - 4, c.margin + 6, c.y - 4);
        c.y += 8;
        break;
      }
      case "code": {
        renderCodeBlock(c, node.value);
        c.y += 8;
        break;
      }
      case "thematicBreak": {
        advanceLine(c, 14);
        c.doc.setDrawColor(180, 180, 180);
        c.doc.setLineWidth(1);
        c.doc.line(c.margin, c.y - 6, c.margin + c.contentWidth, c.y - 6);
        c.y += 8;
        break;
      }
      case "table": {
        const [headerRow, ...bodyRows] = node.children;
        const head = headerRow ? [headerRow.children.map((cell) => flattenToText(cell.children))] : [];
        const body = bodyRows.map((row) => row.children.map((cell) => flattenToText(cell.children)));
        autoTable(c.doc, {
          startY: c.y + 4,
          head,
          body,
          margin: { left: c.margin, right: c.margin },
          styles: { fontSize: 10, cellPadding: 5 },
          headStyles: { fillColor: [232, 232, 232], textColor: [20, 20, 20], fontStyle: "bold" },
          theme: "grid",
        });
        c.y = (c.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
        break;
      }
      default:
        // Raw html and other unsupported node types are dropped, not
        // emitted verbatim — the input is an untrusted uploaded file.
        break;
    }
  }
}

// Builds a real, selectable-text .pdf Blob from raw markdown text, entirely
// in the browser — no upload, no server round trip.
export async function convertToPdf(markdown: string, parseMarkdown: (md: string) => Root): Promise<Blob> {
  const tree = parseMarkdown(markdown);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 50;
  const c: Cursor = {
    doc,
    y: margin,
    margin,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    contentWidth: doc.internal.pageSize.getWidth() - margin * 2,
  };
  renderBlocks(c, tree.children as RootContent[]);
  return doc.output("blob");
}
