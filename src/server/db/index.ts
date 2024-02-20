import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { env } from "@/env";
import * as schema from "./schema";

const poolConnection = mysql.createPool({
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  host: env.DB_HOST,
  port: env.DB_PORT,
});

export const db = drizzle(poolConnection, { schema: schema, mode: "default" });
