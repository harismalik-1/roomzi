# Railway Frontend Dockerfile
FROM node:20-alpine as build

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY frontend/package*.json ./

# Check if bun.lockb exists and copy if it does
COPY frontend/bun.lockb* ./

# Install dependencies
RUN npm ci --only=production=false

# Copy frontend source
COPY frontend/ .

# Build the frontend with all environment variables available
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy Railway-specific nginx config (no backend proxy)
COPY nginx.railway.conf /etc/nginx/nginx.conf

# Copy built frontend
COPY --from=build /app/dist /usr/share/nginx/html

# Create healthcheck endpoint
RUN echo "healthy" > /usr/share/nginx/html/health

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chmod -R 755 /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]