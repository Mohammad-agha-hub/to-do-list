import { NextResponse } from "next/server";
import { body, route } from "@/lib/server/http";
import { BackupFile, exportBackup, importBackup } from "@/lib/server/backup";

export const GET = route(async () => {
  const data = await exportBackup();
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="momentum-backup-${data.exported_at.slice(0, 10)}.json"`,
    },
  });
});

export const POST = route(async (req) => ({ imported: await importBackup(await body(req, BackupFile)) }));
