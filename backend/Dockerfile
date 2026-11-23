FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY *.mjs ./
USER node
EXPOSE 8080
CMD ["node","server.mjs"]
