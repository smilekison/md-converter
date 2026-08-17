# Markdown Studio

A simple, fully client-side web app: upload a `.md`/`.markdown`/`.txt` file and download it as a properly formatted **PDF** or **DOCX** — headings, bold/italic, links, ordered and unordered (including nested and task) lists, code blocks, blockquotes, tables, and horizontal rules are all rendered as real document structure, not a screenshot.

Nothing is uploaded anywhere. Parsing and conversion happen entirely in the browser tab.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, drop in a Markdown file, and download.

## How it works

1. `lib/parseMarkdown.ts` parses the uploaded text into an [mdast](https://github.com/syntax-tree/mdast) syntax tree (via `unified`/`remark-parse`/`remark-gfm`) — the single shared source both converters below, and the live on-page preview, are built from.
2. `lib/convertToDocx.ts` walks that tree and builds a real `.docx` file with the [`docx`](https://www.npmjs.com/package/docx) library.
3. `lib/convertToPdf.ts` walks the same tree and lays out real, selectable PDF text with [`jsPDF`](https://www.npmjs.com/package/jspdf) (tables via `jspdf-autotable`) — including manual word-wrapping across mixed bold/italic/code/link runs and automatic pagination.
4. `lib/inlineRuns.ts` is the shared inline-formatting extractor both converters call, so bold/italic/strikethrough/code/link handling can't drift between the two output formats.

## Known limitations (v1)

- Images referenced in the Markdown are rendered as a `[image: ...]` text placeholder rather than embedded — embedding would require fetching external image bytes client-side, which isn't reliable for arbitrary URLs.
- Ordered-list numbering in the DOCX output restarts at 1 per list rather than tracking state across separate lists in the same document.
- PDF paragraphs wrap flush-left rather than with a hanging indent under list markers.
