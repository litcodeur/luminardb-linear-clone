FROM node:18-alpine AS base

# Install dependencies only when needed
FROM oven/bun:1 as deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json bun.lockb yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN bun install


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

ARG NEXT_PUBLIC_PUSHER_APP_KEY
ENV NEXT_PUBLIC_PUSHER_APP_KEY=$NEXT_PUBLIC_PUSHER_APP_KEY

ARG NEXT_PUBLIC_PUSHER_HOST
ENV NEXT_PUBLIC_PUSHER_HOST=$NEXT_PUBLIC_PUSHER_HOST

ARG PUSHER_APP_ID
ENV PUSHER_APP_ID=$PUSHER_APP_ID

ARG PUSHER_APP_KEY
ENV PUSHER_APP_KEY=$PUSHER_APP_KEY

ARG PUSHER_APP_SECRET
ENV PUSHER_APP_SECRET=$PUSHER_APP_SECRET

ARG PUSHER_APP_HOST
ENV PUSHER_APP_HOST=$PUSHER_APP_HOST

ARG PUSHER_APP_PORT
ENV PUSHER_APP_PORT=$PUSHER_APP_PORT

ARG REDIS_URL
ENV REDIS_URL=$REDIS_URL

RUN yarn build

# If using npm comment out above and use below instead
# RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

ENV NEXT_TELEMETRY_DISABLED 1

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

ARG NEXT_PUBLIC_PUSHER_APP_KEY
ENV NEXT_PUBLIC_PUSHER_APP_KEY=$NEXT_PUBLIC_PUSHER_APP_KEY

ARG NEXT_PUBLIC_PUSHER_HOST
ENV NEXT_PUBLIC_PUSHER_HOST=$NEXT_PUBLIC_PUSHER_HOST

ARG PUSHER_APP_ID
ENV PUSHER_APP_ID=$PUSHER_APP_ID

ARG PUSHER_APP_KEY
ENV PUSHER_APP_KEY=$PUSHER_APP_KEY

ARG PUSHER_APP_SECRET
ENV PUSHER_APP_SECRET=$PUSHER_APP_SECRET

ARG PUSHER_APP_HOST
ENV PUSHER_APP_HOST=$PUSHER_APP_HOST

ARG PUSHER_APP_PORT
ENV PUSHER_APP_PORT=$PUSHER_APP_PORT


# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]