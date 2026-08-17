import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Content, ListItem, PhrasingContent, Root, RootContent, TableCell as MdTableCell } from "mdast";
import { extractInlineRuns, type InlineRun } from "./inlineRuns";

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

const CODE_FONT = "Consolas";
const ORDERED_LIST_REF = "ordered-list";

function runsToTextRuns(runs: InlineRun[]): TextRun[] {
  return runs.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic,
        strike: r.strike,
        font: r.code ? CODE_FONT : undefined,
        color: r.link ? "1155CC" : r.code ? "AD1457" : undefined,
        underline: r.link ? {} : undefined,
        shading: r.code ? { type: ShadingType.CLEAR, fill: "F1F1F1" } : undefined,
      })
  );
}

// A single, deliberately simple ordered-list numbering definition reused by
// every ordered list in the document — restarts at 1 per list is not
// preserved across separate lists, an accepted simplification for a
// single-pass converter with no cross-list state tracking.
export const numberingConfig = {
  config: [
    {
      reference: ORDERED_LIST_REF,
      levels: [0, 1, 2, 3].map((level) => ({
        level,
        format: "decimal" as const,
        text: `%${level + 1}.`,
        alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } } },
      })),
    },
  ],
};

function renderListItem(item: ListItem, ordered: boolean, level: number): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const firstBlock = item.children.find((c) => c.type !== "list");
  const runs = firstBlock && "children" in firstBlock ? extractInlineRuns((firstBlock as { children: PhrasingContent[] }).children) : [];
  out.push(
    new Paragraph({
      children: runsToTextRuns(runs.length ? runs : [{ text: "", bold: false, italic: false, strike: false, code: false }]),
      bullet: ordered ? undefined : { level },
      numbering: ordered ? { reference: ORDERED_LIST_REF, level } : undefined,
    })
  );
  for (const child of item.children) {
    if (child.type === "list") {
      out.push(...renderList(child, level + 1));
    }
  }
  return out;
}

function renderList(node: Extract<Content, { type: "list" }>, level: number): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const item of node.children) {
    out.push(...renderListItem(item, !!node.ordered, level));
  }
  return out;
}

function renderTableCell(cell: MdTableCell, isHeader: boolean): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: runsToTextRuns(extractInlineRuns(cell.children).map((r) => (isHeader ? { ...r, bold: true } : r))),
      }),
    ],
    shading: isHeader ? { type: ShadingType.CLEAR, fill: "E8E8E8" } : undefined,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function renderBlocks(nodes: RootContent[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "heading": {
        out.push(
          new Paragraph({
            heading: HEADING_LEVELS[Math.min(node.depth - 1, 5)],
            children: runsToTextRuns(extractInlineRuns(node.children)),
          })
        );
        break;
      }
      case "paragraph": {
        out.push(new Paragraph({ children: runsToTextRuns(extractInlineRuns(node.children)) }));
        break;
      }
      case "list": {
        out.push(...renderList(node, 0));
        break;
      }
      case "blockquote": {
        // Built directly from each child paragraph's own inline runs
        // (forcing italic) rather than post-processing already-built
        // Paragraph objects, since docx.js doesn't expose their internal
        // TextRuns for re-wrapping after construction.
        for (const child of node.children) {
          if (child.type === "paragraph") {
            const runs = extractInlineRuns(child.children).map((r) => ({ ...r, italic: true }));
            out.push(
              new Paragraph({
                children: runsToTextRuns(runs),
                indent: { left: 480 },
                border: { left: { style: BorderStyle.SINGLE, size: 12, color: "CCCCCC", space: 8 } },
              })
            );
          } else {
            out.push(...renderBlocks([child]));
          }
        }
        break;
      }
      case "code": {
        const lines = node.value.split("\n");
        out.push(
          new Paragraph({
            children: lines.flatMap((line, i) => [
              new TextRun({ text: line, font: CODE_FONT, size: 20 }),
              ...(i < lines.length - 1 ? [new TextRun({ break: 1 })] : []),
            ]),
            shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
            border: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
            },
          })
        );
        break;
      }
      case "thematicBreak": {
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" } } }));
        break;
      }
      case "table": {
        const rows = node.children.map(
          (row, rowIndex) =>
            new TableRow({
              children: row.children.map((cell) => renderTableCell(cell, rowIndex === 0)),
            })
        );
        out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        break;
      }
      default:
        // Raw html and other unsupported node types are dropped, not
        // emitted verbatim — the input is an untrusted uploaded file.
        break;
    }
  }

  return out;
}

// Builds a real .docx Blob from raw markdown text, entirely in the browser
// — no upload, no server round trip.
export async function convertToDocx(markdown: string, parseMarkdown: (md: string) => Root): Promise<Blob> {
  const tree = parseMarkdown(markdown);
  const children = renderBlocks(tree.children as RootContent[]);
  const doc = new Document({
    numbering: numberingConfig,
    sections: [{ children: children.length ? children : [new Paragraph("")] }],
  });
  return Packer.toBlob(doc);
}
