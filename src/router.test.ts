import { describe, expect, it } from "vitest";
import { parseRoute, routePath, type Route } from "./router";

describe("routes", () => {
  it("reads every screen from its address", () => {
    expect(parseRoute("/")).toEqual({ name: "roster" });
    expect(parseRoute("/new")).toEqual({ name: "new" });
    expect(parseRoute("/gm")).toEqual({ name: "gm" });
    expect(parseRoute("/c/abc123")).toEqual({ name: "sheet", id: "abc123", tab: "sheet" });
    expect(parseRoute("/c/abc123/combat")).toEqual({ name: "sheet", id: "abc123", tab: "combat" });
  });

  it("sends anything unknown to the roster or to «Картка»", () => {
    expect(parseRoute("/nonsense")).toEqual({ name: "roster" });
    expect(parseRoute("/c")).toEqual({ name: "roster" });
    expect(parseRoute("/c/abc123/nonsense")).toEqual({ name: "sheet", id: "abc123", tab: "sheet" });
  });

  it("writes the address back the same way", () => {
    const routes: Route[] = [{ name: "roster" }, { name: "new" }, { name: "gm" }, { name: "sheet", id: "abc123", tab: "sheet" }, { name: "sheet", id: "abc123", tab: "notes" }];
    for (const r of routes) expect(parseRoute(routePath(r))).toEqual(r);
    expect(routePath({ name: "sheet", id: "abc123", tab: "sheet" })).toBe("/c/abc123");
  });
});
