FROM node:22-bookworm-slim
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node backend/src ./src
COPY --chown=node:node docker/mongo-provision.js ./docker/mongo-provision.js
RUN mkdir -p /app/uploads /app/private_uploads /app/logs \
    && chown -R node:node /app/uploads /app/private_uploads /app/logs

USER node

EXPOSE 5000
CMD ["node", "src/index.js"]
