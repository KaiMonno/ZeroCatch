import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/?tab=trials&q=pizza")).toBe("/?tab=trials&q=pizza");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined])(
    "rejects %s (open redirect)",
    (next) => {
      expect(safeNextPath(next)).toBe("/");
    },
  );
});
