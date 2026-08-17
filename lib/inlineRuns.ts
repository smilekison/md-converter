import type { PhrasingContent } from "mdast";

// A flattened, style-tagged run of inline text — the shared unit both the
// DOCX and PDF converters build their output from, so bold/italic/code/link
// handling never has to be re-implemented per format.
export type InlineRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  link?: string;
};

type Style = { bold: boolean; italic: boolean; strike: boolean; code: boolean };

// Walks mdast inline children (text, strong, emphasis, delete, inlineCode,
// link, break), combining nested styles (e.g. bold-inside-italic) into one
// flat list of runs. Images inside inline content are rendered as a plain
// bracketed placeholder — see README for why embedding is out of scope.
export function extractInlineRuns(nodes: PhrasingContent[] | undefined, style: Style = { bold: false, italic: false, strike: false, code: false }): InlineRun[] {
  if (!nodes) return [];
  const runs: InlineRun[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        runs.push({ text: node.value, ...style });
        break;
      case "inlineCode":
        runs.push({ text: node.value, ...style, code: true });
        break;
      case "strong":
        runs.push(...extractInlineRuns(node.children, { ...style, bold: true }));
        break;
      case "emphasis":
        runs.push(...extractInlineRuns(node.children, { ...style, italic: true }));
        break;
      case "delete":
        runs.push(...extractInlineRuns(node.children, { ...style, strike: true }));
        break;
      case "break":
        runs.push({ text: "\n", ...style });
        break;
      case "link": {
        const inner = extractInlineRuns(node.children, style);
        for (const run of inner) runs.push({ ...run, link: node.url });
        break;
      }
      case "image":
        runs.push({ text: `[image: ${node.alt || node.url}]`, ...style });
        break;
      default:
        // html and other unsupported inline node types are dropped rather
        // than emitted raw — the input is an untrusted uploaded file.
        break;
    }
  }
  return runs;
}

// Plain-text flattening for contexts (headings, table cells) where a single
// style is applied uniformly rather than run-by-run.
export function flattenToText(nodes: PhrasingContent[] | undefined): string {
  return extractInlineRuns(nodes)
    .map((r) => r.text)
    .join("");
}
