# Deployment Guide

## Overview

This guide covers deployment procedures for the application across different environments, including local development, staging, and production.

## Prerequisites

### System Requirements

- Node.js 18.x or higher
- npm 9.x or higher
- SQLite 3.x (for local storage)
- 2GB RAM minimum (4GB recommended)
- 10GB disk space

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Authentication
JWT_SECRET=your-secure-jwt-secret-key
REFRESH_SECRET=your-secure-refresh-secret-key
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Database
DATABASE_URL=file:./data/knowledge.db

# Embedding Service
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
```

## Local Development

### Quick Start

```bash
# Clone the repository
git clone https://github.com/example/knowledge-store.git
cd knowledge-store

# Install dependencies
npm install

# Build the application
npm run build

# Run in development mode
npm run dev
```

### Development Server

The development server includes hot reloading:

```bash
npm run dev
```

Access the application at `http://localhost:3000`.

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/integration/search.test.ts
```

## Docker Deployment

### Building the Image

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/index.js", "serve"]
```

Build the Docker image:

```bash
docker build -t knowledge-store:latest .
```

### Running with Docker

```bash
# Run container
docker run -d \
  --name knowledge-store \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e JWT_SECRET=your-secret \
  knowledge-store:latest
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  knowledge-store:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Production Deployment

### Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Secrets stored securely
- [ ] Database backups configured
- [ ] Monitoring and alerting set up
- [ ] SSL certificates installed
- [ ] Rate limiting configured
- [ ] CORS policy defined

### Cloud Deployment Options

#### AWS Deployment

**Using AWS ECS:**

1. Create ECR repository
2. Push Docker image to ECR
3. Create ECS cluster
4. Define task definition
5. Create service with load balancer

```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO
docker tag knowledge-store:latest $ECR_REPO/knowledge-store:latest
docker push $ECR_REPO/knowledge-store:latest
```

**Using AWS Lambda:**

```yaml
# serverless.yml
service: knowledge-store
provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
functions:
  api:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: any
```

#### Google Cloud Platform

**Using Cloud Run:**

```bash
# Deploy to Cloud Run
gcloud run deploy knowledge-store \
  --image gcr.io/$PROJECT_ID/knowledge-store \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Kubernetes

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: knowledge-store
spec:
  replicas: 3
  selector:
    matchLabels:
      app: knowledge-store
  template:
    metadata:
      labels:
        app: knowledge-store
    spec:
      containers:
      - name: knowledge-store
        image: knowledge-store:latest
        ports:
        - containerPort: 3000
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: knowledge-store
spec:
  selector:
    app: knowledge-store
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Database Management

### Migrations

```bash
# Run pending migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Create new migration
npm run migrate:create -- add_user_preferences
```

### Backups

```bash
# Create backup
sqlite3 data/knowledge.db ".backup 'backup-$(date +%Y%m%d).db'"

# Restore from backup
sqlite3 data/knowledge.db ".restore 'backup-20240115.db'"
```

### Performance Optimization

```sql
-- Create indexes for common queries
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_chunks_document_id ON chunks(document_id);

-- Analyze tables for query optimization
ANALYZE documents;
ANALYZE chunks;
```

## Monitoring

### Health Checks

The `/health` endpoint provides system status:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": "ok",
    "vectorStore": "ok",
    "memory": "ok"
  }
}
```

### Logging

Configure log aggregation:

```javascript
// Winston configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

### Metrics

Export Prometheus metrics:

```bash
# prometheus.yml
scrape_configs:
  - job_name: 'knowledge-store'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

## Troubleshooting

### Common Issues

**Issue: High memory usage**
- Solution: Increase Node.js heap size with `--max-old-space-size=4096`
- Check for memory leaks in long-running processes

**Issue: Slow search queries**
- Solution: Ensure vector indexes are optimized
- Check FTS index fragmentation
- Consider increasing result cache TTL

**Issue: Connection timeouts**
- Solution: Adjust connection pool settings
- Check network latency
- Verify firewall rules

### Debug Mode

Enable verbose logging for debugging:

```bash
DEBUG=knowledge:* npm start
```

## Security Hardening

### Production Security Checklist

- [ ] Use HTTPS only (redirect HTTP)
- [ ] Enable security headers (Helmet.js)
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Sanitize user inputs
- [ ] Keep dependencies updated
- [ ] Use secure session configuration
- [ ] Implement request size limits

### Security Headers

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```
