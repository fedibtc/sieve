import { migrateDatabase } from "@/server/db/client";

async function main() {
  await migrateDatabase();
  console.log("Database migrations applied.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
