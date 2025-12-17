# System Architecture

## Overview

This document describes the high-level architecture of the application, including its core components, data flow, and integration patterns.

## Architecture Principles

### 1. Separation of Concerns

The system follows a clean architecture approach with distinct layers:

- **Presentation Layer**: Handles user interface and API endpoints
- **Application Layer**: Contains business logic and use cases
- **Domain Layer**: Core business entities and rules
- **Infrastructure Layer**: External services, databases, and frameworks

### 2. Dependency Inversion

All dependencies point inward toward the domain layer. External concerns (databases, APIs, frameworks) depend on abstractions defined in the domain.

## Core Components

### API Gateway

The API Gateway serves as the single entry point for all client requests.

**Responsibilities:**
- Request routing and load balancing
- Authentication and authorization
- Rate limiting and throttling
- Request/response transformation
- API versioning

**Technology:** Express.js with custom middleware stack

### Authentication Service

Handles all authentication and authorization concerns.

**Features:**
- JWT-based authentication with refresh tokens
- OAuth 2.0 integration (Google, GitHub)
- Role-based access control (RBAC)
- Session management

**Security Measures:**
- Password hashing with bcrypt (cost factor 12)
- Token rotation on refresh
- Secure HTTP-only cookies
- CSRF protection

### Knowledge Store

The core component for managing semantic search capabilities.

**Architecture:**
```
┌─────────────────┐     ┌──────────────────┐
│   CLI Client    │────▶│  Knowledge API   │
└─────────────────┘     └──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                      ▼
            ┌──────────────┐      ┌──────────────┐
            │ Vector Store │      │   FTS Index  │
            └──────────────┘      └──────────────┘
```

**Components:**
- **Document Processor**: Chunks and embeds documents
- **Vector Store**: SQLite with vec0 extension for similarity search
- **FTS Index**: Full-text search using SQLite FTS5
- **Query Engine**: Hybrid search combining vector and FTS results

### Event Bus

Asynchronous communication between services using an event-driven architecture.

**Event Types:**
- Domain Events: Business state changes
- Integration Events: Cross-service communication
- System Events: Health, metrics, logging

## Data Flow

### Document Indexing Flow

1. User submits document via CLI or API
2. Document processor validates and chunks content
3. Embedding service generates vector representations
4. Vectors stored in vector database
5. Text indexed in FTS for keyword search
6. Metadata stored in SQLite

### Search Query Flow

1. User submits search query
2. Query preprocessor normalizes input
3. Parallel execution:
   - Vector similarity search
   - Full-text keyword search
4. Result fusion with RRF algorithm
5. Re-ranking based on relevance scores
6. Results returned with snippets

## Integration Patterns

### Database Access

Using the Repository pattern for data access abstraction:

```typescript
interface IRepository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  findMany(options?: QueryOptions<T>): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
```

### External API Integration

Circuit breaker pattern for resilience:

- **Closed State**: Normal operation
- **Open State**: Fail fast when service is down
- **Half-Open State**: Test if service recovered

### Caching Strategy

Multi-level caching approach:

1. **L1 Cache**: In-memory LRU cache (hot data)
2. **L2 Cache**: Redis distributed cache
3. **L3 Cache**: Database query cache

## Scalability Considerations

### Horizontal Scaling

- Stateless services enable horizontal scaling
- Load balancer distributes traffic
- Shared-nothing architecture

### Database Scaling

- Read replicas for query workloads
- Connection pooling
- Query optimization and indexing

### Performance Targets

| Metric | Target | P99 |
|--------|--------|-----|
| API Response Time | < 200ms | < 500ms |
| Search Latency | < 300ms | < 800ms |
| Indexing Throughput | > 100 docs/sec | - |

## Monitoring and Observability

### Metrics

- Request rate and latency
- Error rates and types
- Resource utilization
- Business metrics

### Logging

Structured JSON logging with correlation IDs:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "correlationId": "abc-123",
  "service": "knowledge-store",
  "message": "Document indexed successfully",
  "metadata": {
    "documentId": "doc-456",
    "chunks": 15,
    "duration": 234
  }
}
```

### Distributed Tracing

OpenTelemetry integration for end-to-end request tracing across services.

## Security Architecture

### Defense in Depth

Multiple layers of security controls:

1. **Network**: Firewall rules, VPC isolation
2. **Transport**: TLS 1.3, certificate pinning
3. **Application**: Input validation, output encoding
4. **Data**: Encryption at rest, field-level encryption

### Authentication Flow

```
Client → API Gateway → Auth Service → Token Validation → Protected Resource
```

### Secrets Management

- Environment variables for configuration
- Secrets manager for sensitive data
- Key rotation policies
