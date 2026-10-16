FROM node:22-alpine

WORKDIR /app

# Copy manifests first so the dependency layer is cached
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server.js ./

# Run as the unprivileged user that ships with the node image
USER node

EXPOSE 3000
CMD ["node", "server.js"]
