import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DB_USER: z.string(),
    DB_PASSWORD: z.string(),
    DB_NAME: z.string(),
    DB_HOST: z.string(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DB_PORT: z.coerce.number(),
    PUSHER_APP_ID: z.string(),
    PUSHER_APP_KEY: z.string(),
    PUSHER_APP_SECRET: z.string(),
    PUSHER_APP_HOST: z.string(),
    PUSHER_APP_PORT: z.string(),
    REDIS_URL: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_PUSHER_APP_KEY: z.string(),
    NEXT_PUBLIC_PUSHER_HOST: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_HOST: process.env.DB_HOST,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_PUSHER_APP_KEY: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
    NEXT_PUBLIC_PUSHER_HOST: process.env.NEXT_PUBLIC_PUSHER_HOST,
    PUSHER_APP_ID: process.env.PUSHER_APP_ID,
    PUSHER_APP_KEY: process.env.PUSHER_APP_KEY,
    PUSHER_APP_SECRET: process.env.PUSHER_APP_SECRET,
    PUSHER_APP_HOST: process.env.PUSHER_APP_HOST,
    PUSHER_APP_PORT: process.env.PUSHER_APP_PORT,
    REDIS_URL: process.env.REDIS_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
