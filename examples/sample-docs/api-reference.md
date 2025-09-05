---
title: API Reference
category: API
tags: [api, endpoints, reference]
---

# API Reference

## Authentication

All API requests require authentication using an API key.

### Headers

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

## Endpoints

### GET /api/users

Retrieve a list of users.

**Response:**
```json
{
  "users": [
    {
      "id": "123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ]
}
```

### POST /api/users

Create a new user.

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```
