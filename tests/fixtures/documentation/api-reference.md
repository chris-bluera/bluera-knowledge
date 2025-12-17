# API Reference

## Overview

This document provides a comprehensive reference for the REST API endpoints, including request/response formats, authentication requirements, and error handling.

## Base URL

```
Production: https://api.example.com/v1
Staging: https://staging-api.example.com/v1
Local: http://localhost:3000/v1
```

## Authentication

### Bearer Token Authentication

Most endpoints require authentication using JWT bearer tokens.

```http
Authorization: Bearer <access_token>
```

### Obtaining Tokens

#### POST /auth/login

Authenticate with email and password to receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

#### POST /auth/refresh

Refresh an expired access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

## Knowledge Store Endpoints

### Documents

#### GET /documents

List all indexed documents with pagination.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page (max 100) |
| sortBy | string | createdAt | Sort field |
| sortOrder | string | desc | Sort direction (asc/desc) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "doc-123",
      "filename": "readme.md",
      "path": "/projects/myapp/readme.md",
      "chunks": 15,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### POST /documents

Index a new document.

**Request:**
```json
{
  "content": "# My Document\n\nDocument content here...",
  "metadata": {
    "filename": "readme.md",
    "path": "/projects/myapp/readme.md",
    "tags": ["documentation", "readme"]
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "doc-123",
    "chunks": 15,
    "message": "Document indexed successfully"
  }
}
```

#### GET /documents/:id

Get a specific document by ID.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "doc-123",
    "filename": "readme.md",
    "content": "# My Document...",
    "chunks": [
      {
        "id": "chunk-1",
        "content": "# My Document",
        "index": 0
      }
    ],
    "metadata": {
      "path": "/projects/myapp/readme.md",
      "tags": ["documentation"]
    }
  }
}
```

#### DELETE /documents/:id

Delete a document and its chunks.

**Response (204 No Content)**

### Search

#### POST /search

Search across indexed documents.

**Request:**
```json
{
  "query": "authentication middleware implementation",
  "options": {
    "mode": "hybrid",
    "limit": 10,
    "threshold": 0.5,
    "filters": {
      "tags": ["api", "auth"]
    }
  }
}
```

**Search Modes:**
| Mode | Description |
|------|-------------|
| vector | Semantic similarity search using embeddings |
| fts | Full-text keyword search |
| hybrid | Combined vector and FTS with RRF fusion |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "documentId": "doc-123",
        "chunkId": "chunk-5",
        "content": "The authentication middleware validates JWT tokens...",
        "score": 0.89,
        "metadata": {
          "filename": "auth.ts",
          "path": "/src/middleware/auth.ts"
        }
      }
    ],
    "query": "authentication middleware implementation",
    "mode": "hybrid",
    "totalResults": 25,
    "searchTime": 45
  }
}
```

## User Management

### GET /users

List all users (admin only).

**Required Role:** admin

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {...}
}
```

### POST /users

Create a new user (admin only).

**Required Role:** admin

**Request:**
```json
{
  "email": "newuser@example.com",
  "name": "Jane Smith",
  "password": "securepassword123",
  "role": "user"
}
```

### GET /users/:id

Get user by ID.

### PUT /users/:id

Update user information.

### DELETE /users/:id

Delete a user (admin only).

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "statusCode": 422,
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/v1/documents",
    "requestId": "req-abc123",
    "details": {
      "validationErrors": [
        {
          "field": "content",
          "message": "Content is required"
        }
      ]
    }
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| BAD_REQUEST | 400 | Invalid request parameters |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| VALIDATION_ERROR | 422 | Validation failed |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## Rate Limiting

API requests are rate limited per user:

| Tier | Requests/minute | Burst |
|------|-----------------|-------|
| Free | 60 | 10 |
| Pro | 300 | 50 |
| Enterprise | 1000 | 100 |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705315800
```

## Webhooks

Configure webhooks to receive real-time notifications.

### Webhook Events

| Event | Description |
|-------|-------------|
| document.indexed | Document successfully indexed |
| document.deleted | Document deleted |
| search.completed | Search query completed |

### Webhook Payload

```json
{
  "event": "document.indexed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "documentId": "doc-123",
    "chunks": 15
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { KnowledgeClient } from '@example/knowledge-sdk';

const client = new KnowledgeClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.example.com/v1'
});

// Index a document
const doc = await client.documents.create({
  content: 'Document content...',
  metadata: { filename: 'readme.md' }
});

// Search
const results = await client.search({
  query: 'authentication',
  mode: 'hybrid',
  limit: 10
});
```

### Python

```python
from knowledge_sdk import KnowledgeClient

client = KnowledgeClient(
    api_key='your-api-key',
    base_url='https://api.example.com/v1'
)

# Index a document
doc = client.documents.create(
    content='Document content...',
    metadata={'filename': 'readme.md'}
)

# Search
results = client.search(
    query='authentication',
    mode='hybrid',
    limit=10
)
```
