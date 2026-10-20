import type { z } from "zod";
import { bools, db } from "./db";
import { notFound, setClause, sqlValues } from "./http";
import type { AreaInput, AreaPatch } from "@/lib/shared/schemas";
import type { Area } from "@/lib/shared/types";

export async function listAreas(): Promise<Area[]> {
  return (await (await db()).all<Area>("SELECT * FROM areas ORDER BY archived, sort_order, id")).map((r) => bools(r, ["archived"]));
}

async function getArea(id: number): Promise<Area> {
  const row = await (await db()).get<Area>("SELECT * FROM areas WHERE id = ?", [id]);
  if (!row) throw notFound("Area not found");
  return bools(row, ["archived"]);
}

export async function createArea(input: z.infer<typeof AreaInput>): Promise<Area> {
  const { lastId } = await (await db()).run(
    "INSERT INTO areas (name, color, icon, archived, sort_order) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM areas))",
    [input.name, input.color, input.icon, input.archived],
  );
  return getArea(lastId);
}

export async function updateArea(id: number, patch: z.infer<typeof AreaPatch>): Promise<Area> {
  await getArea(id);
  const values = sqlValues(patch);
  const set = setClause(values, ["name", "color", "icon", "archived"]);
  if (set) await (await db()).run(`UPDATE areas SET ${set} WHERE id = @id`, { ...values, id });
  return getArea(id);
}

export async function deleteArea(id: number) {
  await getArea(id);
  await (await db()).run("DELETE FROM areas WHERE id = ?", [id]);
}
