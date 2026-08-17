import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement these, and lib/download.ts's downloadBlob() calls
// both. Defined unconditionally (not just when missing) and explicitly
// configurable so individual tests can still vi.spyOn() over this default
// regardless of what jsdom itself provides.
Object.defineProperty(URL, "createObjectURL", {
  value: () => "blob:mock-url",
  writable: true,
  configurable: true,
});
Object.defineProperty(URL, "revokeObjectURL", {
  value: () => {},
  writable: true,
  configurable: true,
});
