FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    CHANG_MATERIAL_DB_PATH=/var/lib/chang/chang_material_control.db

WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY public ./public
COPY data ./data

RUN mkdir -p /var/lib/chang \
    && chown -R node:node /app /var/lib/chang

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--experimental-sqlite", "server.js"]
