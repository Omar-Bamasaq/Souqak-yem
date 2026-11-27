FROM node:20-alpine AS base
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY shared/seoRules.mjs /shared/seoRules.mjs
COPY backend/src ./src
COPY frontend/index.html ./frontend/index.html

# Writable application logs for the non-root runtime user.
RUN mkdir -p /app/logs \
    && chown node:node /app/logs \
    && chmod 700 /app/logs

USER node
EXPOSE 5000
CMD ["node", "src/index.js"]
