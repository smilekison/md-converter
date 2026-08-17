import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { Root } from "mdast";

const parser = unified().use(remarkParse).use(remarkGfm);

// Parses raw markdown text into an mdast syntax tree — the single shared
// source both the DOCX and PDF converters walk, so headings/lists/tables
// can never drift between the two output formats.
export function parseMarkdown(markdown: string): Root {
  return parser.parse(markdown) as Root;
}

// Renders the same markdown to sanitized HTML for the on-page live preview.
// Sanitizing (not just trusting remark's output) matters here specifically
// because the input is an arbitrary user-uploaded file, not our own content.
export async function renderPreviewHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}
