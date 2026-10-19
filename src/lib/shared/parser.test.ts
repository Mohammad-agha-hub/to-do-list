import { describe, expect, it } from "vitest";
import { fuzzyScore, parseQuickAdd } from "./parser";

// 2026-10-19 is a Monday.
const ctx = {
  today: "2026-10-19",
  areas: [
    { id: 1, name: "School" },
    { id: 2, name: "Hazara Kids" },
    { id: 5, name: "German" },
  ],
  goals: [
    { id: 10, title: "Publish 12 Hazara Kids episodes", status: "active" },
    { id: 11, title: "Learn 1,500 German words", status: "active" },
    { id: 12, title: "Old episodes archive", status: "abandoned" },
  ],
};

describe("parseQuickAdd", () => {
  it("parses the spec example", () => {
    const r = parseQuickAdd("edit ep 4 #hazarakids !1 tomorrow ~2h @episodes", ctx);
    expect(r).toMatchObject({
      title: "edit ep 4",
      area_id: 2,
      priority: 1,
      scheduled_date: "2026-10-20",
      estimate_min: 120,
      goal_id: 10,
    });
    expect(r.chips.map((c) => c.kind)).toEqual(["area", "priority", "date", "estimate", "goal"]);
  });

  it("supports word priorities", () => {
    expect(parseQuickAdd("x !high", ctx).priority).toBe(1);
    expect(parseQuickAdd("x !med", ctx).priority).toBe(2);
    expect(parseQuickAdd("x !low", ctx).priority).toBe(3);
  });

  it("parses estimates", () => {
    expect(parseQuickAdd("a ~30m", ctx).estimate_min).toBe(30);
    expect(parseQuickAdd("a ~45", ctx).estimate_min).toBe(45);
    expect(parseQuickAdd("a ~1.5h", ctx).estimate_min).toBe(90);
    expect(parseQuickAdd("a ~1h30m", ctx).estimate_min).toBe(90);
    expect(parseQuickAdd("a ~abc", ctx).title).toBe("a ~abc");
  });

  it("parses dates", () => {
    expect(parseQuickAdd("a today", ctx).scheduled_date).toBe("2026-10-19");
    expect(parseQuickAdd("a friday", ctx).scheduled_date).toBe("2026-10-23");
    expect(parseQuickAdd("a monday", ctx).scheduled_date).toBe("2026-10-19");
    expect(parseQuickAdd("a sunday", ctx).scheduled_date).toBe("2026-10-25");
    expect(parseQuickAdd("a 25-10", ctx).scheduled_date).toBe("2026-10-25");
    expect(parseQuickAdd("a 05/01", ctx).scheduled_date).toBe("2027-01-05");
    expect(parseQuickAdd("a 31-02", ctx).scheduled_date).toBeUndefined();
  });

  it("keeps unknown tags in the title", () => {
    const r = parseQuickAdd("buy milk #nowhere", ctx);
    expect(r.title).toBe("buy milk #nowhere");
    expect(r.area_id).toBeUndefined();
  });

  it("prefers active goals", () => {
    expect(parseQuickAdd("a @episodes", ctx).goal_id).toBe(10);
  });

  it("matches German case-insensitively", () => {
    expect(parseQuickAdd("Vokabeln #german", ctx).area_id).toBe(5);
  });

  it("does not treat sat/sun as dates", () => {
    expect(parseQuickAdd("SAT prep", ctx).title).toBe("SAT prep");
  });
});

describe("fuzzyScore", () => {
  it("ranks prefix over substring over subsequence", () => {
    const prefix = fuzzyScore("haz", "Hazara Kids");
    const word = fuzzyScore("kids", "Hazara Kids");
    const sub = fuzzyScore("hzk", "Hazara Kids");
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(sub);
    expect(sub).toBeGreaterThan(0);
    expect(fuzzyScore("xyz", "Hazara Kids")).toBe(0);
  });
});
