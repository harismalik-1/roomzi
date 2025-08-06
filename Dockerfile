# This is a root-level Dockerfile for Railway deployment
# Railway expects a Dockerfile in the root directory

# Use the frontend Dockerfile from CICD directory
FROM node:20-alpine as frontend-build

# Set working directory
WORKDIR /app

# Copy package files
COPY frontend/package*.json ./
COPY frontend/bun.lockb ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ .

# Build the frontend
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Copy custom nginx config
COPY CICD/nginx.conf /etc/nginx/nginx.conf

# Copy built frontend
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /usr/share/nginx/html && \
    chown -R nextjs:nodejs /var/cache/nginx && \
    chown -R nextjs:nodejs /var/log/nginx && \
    chown -R nextjs:nodejs /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nextjs:nodejs /var/run/nginx.pid

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD sh -c "if [ -f /usr/share/nginx/html/index.html ]; then exit 0; else exit 1; fi"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]