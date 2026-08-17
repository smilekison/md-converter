"use client";

import { useEffect, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { parseMarkdown, renderPreviewHtml } from "@/lib/parseMarkdown";
import { convertToDocx } from "@/lib/convertToDocx";
import { convertToPdf } from "@/lib/convertToPdf";
import { downloadBlob, baseName } from "@/lib/download";

type Converting = "pdf" | "docx" | null;

export default function Home() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [converting, setConverting] = useState<Converting>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!markdown) return;
    let cancelled = false;
    renderPreviewHtml(markdown).then((html) => {
      if (!cancelled) setPreviewHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [markdown]);

  function handleFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setMarkdown(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  }

  function reset() {
    setFileName(null);
    setMarkdown("");
    setPreviewHtml("");
    setError(null);
  }

  async function handleDownload(format: "pdf" | "docx") {
    setError(null);
    setConverting(format);
    try {
      const blob = format === "pdf" ? await convertToPdf(markdown, parseMarkdown) : await convertToDocx(markdown, parseMarkdown);
      downloadBlob(blob, `${baseName(fileName ?? "document")}.${format}`);
    } catch {
      setError(`Something went wrong converting to ${format.toUpperCase()}. Please check the file and try again.`);
    } finally {
      setConverting(null);
    }
  }

  return (
    <main className="flex-1 mx-auto w-full max-w-4xl px-6 py-14">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Markdown Studio</h1>
        <p className="mt-2 text-muted">Convert a Markdown file into a properly formatted PDF or Word document — right in your browser. Nothing is ever uploaded anywhere.</p>
      </header>

      {!fileName ? (
        <UploadZone onFile={handleFile} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{fileName}</p>
              <p className="text-xs text-muted">{markdown.split(/\r\n|\r|\n/).length} lines</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleDownload("pdf")}
                disabled={converting !== null}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity disabled:opacity-50"
              >
                {converting === "pdf" ? "Converting…" : "Download PDF"}
              </button>
              <button
                onClick={() => handleDownload("docx")}
                disabled={converting !== null}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
              >
                {converting === "docx" ? "Converting…" : "Download DOCX"}
              </button>
              <button onClick={reset} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground">
                Choose another file
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="rounded-xl border border-border bg-surface p-8">
            <div className="prose prose-neutral dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}

      <footer className="mt-16 text-center text-xs text-muted">
        Runs entirely client-side — your file is parsed and converted in this browser tab and is never sent to a server.
      </footer>
    </main>
  );
}
