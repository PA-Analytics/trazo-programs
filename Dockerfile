# Stage 1: Build static assets and check types
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY vite.config.ts index.html ./
COPY *.png ./
COPY src/ ./src/

RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets and server source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/*.png ./

EXPOSE 8080

USER node

CMD ["node", "--experimental-strip-types", "src/server/index.ts"]
