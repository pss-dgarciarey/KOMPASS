FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-slim
ENV NODE_ENV=production
ENV PORT=8080
ENV SQLITE_PATH=/app/data/kompass.sqlite
WORKDIR /app

COPY backend /app/backend
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

WORKDIR /app/backend
RUN rm -rf node_modules && npm ci --omit=dev

RUN mkdir -p /app/data

WORKDIR /app/backend
EXPOSE 8080
CMD ["node", "index.js"]
