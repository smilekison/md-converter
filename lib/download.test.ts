import { afterEach, describe, expect, it, vi } from "vitest";
import { baseName, downloadBlob } from "./download";

describe("baseName", () => {
  it("strips a .md extension", () => {
    expect(baseName("notes.md")).toBe("notes");
  });

  it("strips a .markdown extension", () => {
    expect(baseName("README.markdown")).toBe("README");
  });

  it("strips a .txt extension", () => {
    expect(baseName("plain.txt")).toBe("plain");
  });

  it("is case-insensitive on the extension", () => {
    expect(baseName("Notes.MD")).toBe("Notes");
  });

  it("leaves a filename with no recognized extension untouched", () => {
    expect(baseName("archive.tar.gz")).toBe("archive.tar.gz");
  });

  it("only strips the trailing extension, not an earlier dot in the name", () => {
    expect(baseName("v1.2.md")).toBe("v1.2");
  });
});

describe("downloadBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an object URL, clicks a temporary anchor with the given filename, then revokes the URL", () => {
    const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-url");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const blob = new Blob(["content"], { type: "application/pdf" });
    downloadBlob(blob, "report.pdf");

    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:test-url");
  });

  it("does not leave the temporary anchor element in the document afterward", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(new Blob(["x"]), "x.docx");

    expect(document.querySelector('a[download="x.docx"]')).toBeNull();
  });
});
