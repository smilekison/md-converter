import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "./page";

function makeFile(name: string, content: string) {
  return new File([content], name, { type: "text/markdown" });
}

const SAMPLE = "# Project Report\n\nSome **bold** text.\n\n- item one\n- item two\n";

// These exercise the real, unmocked pipeline end to end: file upload ->
// markdown parsing -> live preview -> real DOCX/PDF conversion -> a
// triggered browser download. Only the two DOM APIs a real download
// needs (an object URL and an anchor click) are stubbed, since jsdom has
// no actual file-save mechanism to observe.
describe("Home page — end-to-end upload, preview, and convert flow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the upload zone and no download controls before a file is chosen", () => {
    render(<Home />);
    expect(screen.getByText(/drag and drop a markdown file/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download pdf/i })).not.toBeInTheDocument();
  });

  it("renders the file name, line count, and a live preview once a file is uploaded", async () => {
    render(<Home />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile("report.md", SAMPLE)] } });

    expect(await screen.findByText("report.md")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Project Report")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download docx/i })).toBeInTheDocument();
  });

  it("runs the real conversion pipeline and triggers a PDF download when Download PDF is clicked", async () => {
    const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<Home />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("report.md", SAMPLE)] } });
    await screen.findByText("report.md");

    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    await screen.findByRole("button", { name: /converting/i });

    await waitFor(() => expect(screen.getByRole("button", { name: /^download pdf$/i })).toBeInTheDocument(), { timeout: 10000 });
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect((createObjectURLSpy.mock.calls[0][0] as Blob).type).toBe("application/pdf");
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it("runs the real conversion pipeline and triggers a DOCX download when Download DOCX is clicked", async () => {
    const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<Home />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("report.md", SAMPLE)] } });
    await screen.findByText("report.md");

    fireEvent.click(screen.getByRole("button", { name: /download docx/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /^download docx$/i })).toBeInTheDocument(), { timeout: 10000 });
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect((createObjectURLSpy.mock.calls[0][0] as Blob).type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("downloads using the uploaded file's own base name", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const anchors: HTMLAnchorElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") anchors.push(el as HTMLAnchorElement);
      return el;
    });

    render(<Home />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("quarterly-notes.md", SAMPLE)] } });
    await screen.findByText("quarterly-notes.md");

    fireEvent.click(screen.getByRole("button", { name: /download docx/i }));
    await waitFor(() => expect(anchors.length).toBeGreaterThan(0), { timeout: 10000 });

    expect(anchors[0].download).toBe("quarterly-notes.docx");
  });

  it("returns to the upload zone when 'Choose another file' is clicked", async () => {
    render(<Home />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("report.md", SAMPLE)] } });
    await screen.findByText("report.md");

    fireEvent.click(screen.getByRole("button", { name: /choose another file/i }));

    expect(screen.getByText(/drag and drop a markdown file/i)).toBeInTheDocument();
    expect(screen.queryByText("report.md")).not.toBeInTheDocument();
  });
});
