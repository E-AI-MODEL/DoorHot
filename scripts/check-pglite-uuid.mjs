
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
try {
  const result = await db.query("SELECT gen_random_uuid() AS id");
  console.log(JSON.stringify(result.rows));
} finally {
  await db.close();
}
