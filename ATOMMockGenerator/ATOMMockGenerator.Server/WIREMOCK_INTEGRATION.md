# ATOM Mock Generator - Wiremock Integration

This document explains how to use the ATOM Mock Generator to validate configurations and automatically deploy them to Wiremock instances using Wiremock's admin API.

## New Endpoints

### 1. Validate and Deploy Config
**POST** `/api/config/validate-and-deploy`

This endpoint validates your ATOM or legacy config and then automatically creates all mappings in the target Wiremock instance.

**Request Body:** JSON configuration (ATOM or legacy format)

**Example ATOM Config:**
```json
{
  "version": "1.0",
  "target": {
    "baseUrl": "http://localhost:8080",
    "auth": {
      "type": "basic",
      "username": "admin",
      "password": "admin123"
    }
  },
  "defaults": {
    "priority": 5,
    "headers": {
      "Content-Type": "application/json"
    }
  },
  "mocks": [
    {
      "name": "Get planned outages",
      "priority": 1,
      "request": {
        "method": "GET",
        "urlPattern": "/webapi/OutageListData/GetDetailedPlannedOutages.*"
      },
      "response": {
        "status": 200,
        "body": {
          "type": "inline",
          "value": "[{\"Area\":\"Berry Park, Duckenfield, Millers Forest, Morpeth\",\"Cause\":\"Replacing or fixing powerlines above ground in your neighbourhood\",\"Detail\":\"\",\"Customers\":\"79\",\"EndDateTime\":\"2025-06-19T16:00:00\",\"StartDateTime\":\"2025-06-19T08:00:00\",\"Status\":\"Proceeding as scheduled\",\"Reason\":null,\"Streets\":\"Duckenfield Rd, Duckenfield Wharf Rd, Eales Rd, McFarlanes Rd, Raymond Terrace Rd, Wharf Rd\",\"WebId\":80450,\"JobId\":\"120938\"}]"
        },
        "headers": {
          "Content-Type": "application/json"
        }
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully validated and deployed 1 mappings to http://localhost:8080",
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": []
  },
  "deployed": {
    "target": "http://localhost:8080",
    "mappingsCount": 1,
    "mappings": [
      {
        "id": "12345678-1234-1234-1234-123456789012",
        "method": "GET",
        "url": "/webapi/OutageListData/GetDetailedPlannedOutages.*"
      }
    ]
  }
}
```

### 2. Deploy Existing Mappings
**POST** `/api/config/deploy-mappings`

Deploy a list of pre-generated Wiremock mappings to a target instance.

**Request Body:**
```json
{
  "targetUrl": "http://localhost:8080",
  "auth": {
    "type": "basic",
    "username": "admin",
    "password": "admin123"
  },
  "mappings": [
    {
      "request": {
        "method": "GET",
        "urlPattern": "/webapi/OutageListData/GetDetailedPlannedOutages.*"
      },
      "response": {
        "status": 200,
        "body": "[{\"Area\":\"Berry Park\"}]",
        "headers": {
          "Content-Type": "application/json"
        }
      }
    }
  ]
}
```

### 3. Reset Wiremock Mappings
**DELETE** `/api/config/reset-wiremock`

Remove all mappings from a Wiremock instance.

**Request Body:**
```json
{
  "targetUrl": "http://localhost:8080",
  "auth": {
    "type": "basic",
    "username": "admin",
    "password": "admin123"
  }
}
```

## Authentication Support

The service supports multiple authentication types:

- **None:** No authentication required
- **Basic:** Username and password authentication
- **Bearer:** Token-based authentication

## Wiremock Admin API Integration

The service uses Wiremock's admin API endpoints:

- `POST /__admin/mappings` - Create individual mappings
- `GET /__admin/mappings` - Get all mappings
- `DELETE /__admin/mappings/{id}` - Delete specific mapping
- `POST /__admin/mappings/reset` - Reset all mappings

## Example Usage with curl

### Validate and Deploy
```bash
curl -X POST http://localhost:5000/api/config/validate-and-deploy \
  -H "Content-Type: application/json" \
  -d @atom-config.json
```

### Reset Wiremock
```bash
curl -X DELETE http://localhost:5000/api/config/reset-wiremock \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "http://localhost:8080",
    "auth": {
      "type": "basic",
      "username": "admin",
      "password": "admin123"
    }
  }'
```

## Configuration Features

### ATOM Config Structure
- **version:** Configuration version
- **target:** Target Wiremock instance details including authentication
- **defaults:** Default values applied to all mocks
- **mocks:** Array of mock configurations

### Request Matching
- **url:** Exact URL match
- **urlPattern:** Regex pattern matching
- **urlPath:** Exact path match
- **urlPathPattern:** Regex path pattern
- **pathTemplate:** Template with placeholders (e.g., `/users/{id}`)

### Response Configuration
- **status:** HTTP status code
- **headers:** Response headers
- **body:** Response body (inline or file-based)
- **fixedDelayMilliseconds:** Response delay

### Advanced Features
- **scenarios:** Stateful behavior
- **priority:** Mapping priority (lower numbers = higher priority)
- **templating:** Response templating support
- **metadata:** Additional mapping metadata

## Error Handling

The service provides detailed error messages and validation feedback:

- Configuration validation errors
- Wiremock connection issues
- Authentication failures
- Mapping creation failures

Individual mapping failures don't stop the entire deployment process - successful mappings will still be created.