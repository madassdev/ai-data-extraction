FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY *.mjs ./
COPY public ./public
USER node
EXPOSE 5180
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:5180/health || exit 1
CMD ["node", "server.mjs"]
