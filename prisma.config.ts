import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { defineConfig } from "prisma/config";

// Load environment variables dynamically
const envPath = fs.existsSync(path.join(process.cwd(), ".env"))
  ? path.join(process.cwd(), ".env")
  : fs.existsSync(path.join(process.cwd(), ".env.development"))
    ? path.join(process.cwd(), ".env.development")
    : null;

if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Manual variable expansion for DATABASE_URL (since dotenv doesn't support it by default)
let databaseUrl = process.env["DATABASE_URL"] || "";
if (databaseUrl.includes("${")) {
  databaseUrl = databaseUrl.replace(/\${([^}]+)}/g, (_, g) => process.env[g] || "");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
