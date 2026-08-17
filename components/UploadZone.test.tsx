import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UploadZone } from "./UploadZone";

function makeFile(name: string, content = "hello", type = "text/markdown") {
  return new File([content], name, { type });
}

describe("UploadZone", () => {
  it("calls onFile when a valid .md file is chosen via the file picker", () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile("notes.md")] } });

    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0][0].name).toBe("notes.md");
  });

  it("accepts .markdown and .txt files as well as .md", () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile("README.markdown")] } });
    fireEvent.change(input, { target: { files: [makeFile("plain.txt")] } });

    expect(onFile).toHaveBeenCalledTimes(2);
  });

  it("rejects an unsupported file extension, shows an error, and does not call onFile", async () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile("image.png", "binary", "image/png")] } });

    expect(onFile).not.toHaveBeenCalled();
    expect(await screen.findByText(/please choose a \.md/i)).toBeInTheDocument();
  });

  it("clears a previous error once a subsequent valid file is chosen", async () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile("image.png", "binary", "image/png")] } });
    expect(await screen.findByText(/please choose a \.md/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [makeFile("ok.md")] } });
    expect(screen.queryByText(/please choose a \.md/i)).not.toBeInTheDocument();
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it("accepts a file dropped onto the dropzone", () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const dropzone = screen.getByRole("button");

    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile("dropped.md")] } });

    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0][0].name).toBe("dropped.md");
  });

  it("rejects a dropped file with an unsupported extension", () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const dropzone = screen.getByRole("button");

    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile("image.png", "binary", "image/png")] } });

    expect(onFile).not.toHaveBeenCalled();
  });

  it("ignores a drop/change event with no files", () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [] } });

    expect(onFile).not.toHaveBeenCalled();
  });
});
