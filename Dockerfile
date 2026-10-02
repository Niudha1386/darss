FROM node:20-slim

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install dependencies
COPY .npmrc package*.json ./
RUN npm install --include=dev --legacy-peer-deps

# Copy application code
COPY . .

# Build Vite frontend assets
RUN npm run build

# Expose server port
EXPOSE 3000

# Run the full-stack server
CMD ["npx", "tsx", "server.ts"]
