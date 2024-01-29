import { createTRPCRouter } from "@/server/api/trpc";
import { pullRouter } from "./routers/pull";
import { mutationRouter } from "./routers/mutators";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  pull: pullRouter,
  mutate: mutationRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
