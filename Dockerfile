FROM node:20-alpine AS base
WORKDIR /app

COPY backend/package.json backend/package-lock.json* backend/ ./
RUN npm ci --omit=dev

COPY backend/src ./src

EXPOSE 5000
CMD ["node", "src/index.js"]

