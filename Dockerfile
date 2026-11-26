FROM node:20-alpine AS base
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY shared/seoRules.mjs /shared/seoRules.mjs
COPY backend/src ./src
COPY frontend/index.html ./frontend/index.html

USER node
EXPOSE 5000
CMD ["node", "src/index.js"]
