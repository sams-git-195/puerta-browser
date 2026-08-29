import { describe, expect, it } from "vitest";
import { getOriginFromURL } from "../../src/shared/utility";

describe("getOriginFromURL", () => {
  it("returns the hostname for http(s) URLs", () => {
    expect(getOriginFromURL("https://example.com/path?q=1")).toBe("example.com");
    expect(getOriginFromURL("http://sub.example.com:8080/x")).toBe("sub.example.com");
  });

  it("returns the input unchanged when it is not a valid URL", () => {
    expect(getOriginFromURL("not a url")).toBe("not a url");
  });
});
