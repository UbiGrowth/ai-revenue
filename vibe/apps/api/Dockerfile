FROM node:20-slim

# Install git for repository operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*
# Verify git installation: docker compose exec api git --version

WORKDIR /app

# Copy package files
COPY package.json ./
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm install
RUN npm install --workspace=apps/api

# Copy source
COPY apps/api ./apps/api

# Build
RUN npm run build --workspace=apps/api

EXPOSE 3001

CMD ["npm", "start", "--workspace=apps/api"]
