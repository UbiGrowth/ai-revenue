FROM node:20-slim

# Install git for repository operations (ripgrep not available in Debian repos, will install separately)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install ripgrep from GitHub releases with architecture detection
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ]; then \
      curl -LO https://github.com/BurntSushi/ripgrep/releases/download/14.1.0/ripgrep_14.1.0-1_amd64.deb && \
      dpkg -i ripgrep_14.1.0-1_amd64.deb && \
      rm ripgrep_14.1.0-1_amd64.deb; \
    elif [ "$ARCH" = "arm64" ]; then \
      curl -LO https://github.com/BurntSushi/ripgrep/releases/download/14.1.0/ripgrep_14.1.0-1_arm64.deb && \
      dpkg -i ripgrep_14.1.0-1_arm64.deb && \
      rm ripgrep_14.1.0-1_arm64.deb; \
    else \
      echo "Unsupported architecture: $ARCH" && exit 1; \
    fi

WORKDIR /app

# Copy package files
COPY package.json ./
COPY apps/executor/package.json ./apps/executor/

# Install dependencies
RUN npm install
RUN npm install --workspace=apps/executor

# Copy source
COPY apps/executor ./apps/executor

# Build
RUN npm run build --workspace=apps/executor

CMD ["npm", "start", "--workspace=apps/executor"]
