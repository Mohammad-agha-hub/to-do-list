import type { z } from "zod";
import { bools, db } from "./db";
import { notFound, setClause, sqlValues } from "./http";
import type { AreaInput, AreaPatch } from "@/lib/shared/schemas";
import type { Area } from "@/lib/shared/types";

export function listAreas(): Area[] {
  return db()
    .prepare("SELECT * FROM areas ORDER BY archived, sort_order, id")
    .all()
    .map((r) => bools(r as Area, ["archived"]));
}

function getArea(id: number): Area {
  const row = db().prepare("SELECT * FROM areas WHERE id = ?").get(id);
  if (!row) throw notFound("Area not found");
  return bools(row as Area, ["archived"]);
}

export function createArea(input: z.infer<typeof AreaInput>): Area {
  const { n } = db().prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM areas").get() as { n: number };
  const info = db()
    .prepare("INSERT INTO areas (name, color, icon, archived, sort_order) VALUES (?, ?, ?, ?, ?)")
    .run(input.name, input.color, input.icon, input.archived ? 1 : 0, n);
  return getArea(Number(info.lastInsertRowid));
}

export function updateArea(id: number, patch: z.infer<typeof AreaPatch>): Area {
  getArea(id);
  const values = sqlValues(patch);
  const set = setClause(values, ["name", "color", "icon", "archived"]);
  if (set) db().prepare(`UPDATE areas SET ${set} WHERE id = @id`).run({ ...values, id });
  return getArea(id);
}

export function deleteArea(id: number) {
  getArea(id);
  db().prepare("DELETE FROM areas WHERE id = ?").run(id);
}
