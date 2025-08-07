# Backend Dockerfile for Railway Deployment
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for Prisma and health check
RUN apk add --no-cache openssl curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy Prisma schema first (for generation)
COPY prisma ./prisma/

# Accept build arguments for environment variables
ARG DATABASE_URL
ARG DIRECT_URL
ARG SUPABASE_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ARG FRONTEND_URL
ARG OPENAI_API_KEY
ARG NODE_ENV=production
ARG PORT=8080

# Set environment variables
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV FRONTEND_URL=$FRONTEND_URL
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV NODE_ENV=$NODE_ENV
ENV PORT=$PORT

# Generate Prisma client
RUN npx prisma generate

# Copy application source code
COPY src ./src/

# Create uploads directory
RUN mkdir -p uploads

# Expose the port the app runs on
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/api/health || exit 1

# Start the application
CMD ["npm", "start"]