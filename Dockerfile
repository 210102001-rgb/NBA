# NBA backend — Express + node:sqlite (built-in, tanpa native build).
FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3003 NBA_DB_PATH=/data/nba.sqlite
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3003
CMD ["node", "src/server.js"]
