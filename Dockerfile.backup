FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the entire repo (includes api/, functions/, etc.)
COPY . .

# Expose the port Cloud Run expects
ENV PORT=8080
EXPOSE 8080

# Start the API server
CMD ["node", "api/server.js"]
