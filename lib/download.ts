// Triggers a browser save-file prompt for an in-memory Blob — no server
// round trip, the file never leaves the user's device.
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function baseName(filename: string): string {
  return filename.replace(/\.(md|markdown|txt)$/i, "");
}
