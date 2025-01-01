# Base node image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install pnpm globally and configure store
RUN npm install -g pnpm
RUN pnpm config set store-dir /app/.pnpm-store

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies including Tailwind CSS requirements
RUN pnpm install --frozen-lockfile
RUN pnpm add -D autoprefixer postcss tailwindcss

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm globally and configure store
RUN npm install -g pnpm
RUN pnpm config set store-dir /app/.pnpm-store

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application with type checking and ESLint disabled
ENV DISABLE_ESLINT_PLUGIN=true
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install pnpm globally and configure store
RUN npm install -g pnpm
RUN pnpm config set store-dir /app/.pnpm-store

# Create necessary directories and copy built assets
RUN mkdir -p public .next/static
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]