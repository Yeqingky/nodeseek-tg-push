FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src
RUN mkdir -p /app/data && chown node:node /app/data

USER node
VOLUME ["/app/data"]
CMD ["npm", "start"]
