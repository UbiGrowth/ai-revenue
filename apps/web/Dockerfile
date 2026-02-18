FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy config files
COPY postcss.config.js ./
COPY tsconfig.json* ./
COPY next.config.* ./

# Copy source files
COPY . .

# Build the application
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY package*.json ./

ENV NODE_ENV=production

CMD ["npm", "start"]
