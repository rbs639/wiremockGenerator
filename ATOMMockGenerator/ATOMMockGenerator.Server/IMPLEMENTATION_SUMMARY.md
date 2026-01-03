# Wiremock Integration Implementation Summary

## What has been implemented:

### 1. **WiremockAdminService** (`ATOMMockGenerator.Server/Services/WiremockAdminService.cs`)
- New service that communicates with Wiremock's admin API
- Supports creating, deleting, and retrieving mappings
- Full authentication support (Basic, Bearer, None)
- Comprehensive error handling and logging
- Batch operations for multiple mappings

### 2. **New Controller Endpoints** (`ATOMMockGenerator.Server/Controllers/ConfigController.cs`)

#### **POST `/api/config/validate-and-deploy`**
- **Purpose**: Validates config and automatically deploys to Wiremock
- **Input**: ATOM or legacy config JSON
- **Process**: 
  1. Validates configuration
  2. Extracts target Wiremock URL and auth from config
  3. Converts mocks to Wiremock mappings
  4. Creates mappings via `POST /__admin/mappings`
- **Output**: Validation results + deployment status

#### **POST `/api/config/deploy-mappings`**
- **Purpose**: Deploy pre-generated mappings to Wiremock
- **Input**: Target URL, auth config, and mappings array
- **Process**: Sends each mapping to Wiremock's admin API

#### **DELETE `/api/config/reset-wiremock`**
- **Purpose**: Clear all mappings from Wiremock instance
- **Input**: Target URL and auth config
- **Process**: Calls `POST /__admin/mappings/reset`

#### **GET `/api/config/example-usage`**
- **Purpose**: Documentation endpoint with usage examples

### 3. **Enhanced Models** (`ATOMMockGenerator.Server/Models/WiremockModels.cs`)
- Added `DeployMappingsRequest` class
- Added `ResetWiremockRequest` class
- Enhanced authentication configuration

### 4. **Service Registration** (`ATOMMockGenerator.Server/Program.cs`)
- Registered `IWiremockAdminService` with HttpClient dependency injection
- Configured 30-second timeout for HTTP requests

### 5. **Updated Template** 
- Enhanced ATOM config template with your outage data example
- Includes proper authentication configuration
- Shows various request matching patterns

## Example Usage:

### Validate and Deploy Config (matches your Postman request):
```bash
curl -X POST http://localhost:5000/api/config/validate-and-deploy \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "target": {
      "baseUrl": "http://localhost:8080",
      "auth": {
        "type": "basic",
        "username": "admin", 
        "password": "admin123"
      }
    },
    "mocks": [
      {
        "name": "Get planned outages",
        "request": {
          "method": "GET",
          "urlPattern": "/webapi/OutageListData/GetDetailedPlannedOutages.*"
        },
        "response": {
          "status": 200,
          "headers": {
            "Content-Type": "application/json"
          },
          "body": {
            "type": "inline", 
            "value": "[{\"Area\":\"Berry Park, Duckenfield, Millers Forest, Morpeth\",\"Cause\":\"Replacing or fixing powerlines above ground in your neighbourhood\",\"Detail\":\"\",\"Customers\":\"79\",\"EndDateTime\":\"2025-06-19T16:00:00\",\"StartDateTime\":\"2025-06-19T08:00:00\",\"Status\":\"Proceeding as scheduled\",\"Reason\":null,\"Streets\":\"Duckenfield Rd, Duckenfield Wharf Rd, Eales Rd, McFarlanes Rd, Raymond Terrace Rd, Wharf Rd\",\"WebId\":80450,\"JobId\":\"120938\"}]"
          }
        }
      }
    ]
  }'
```

This will:
1. ? Validate the ATOM configuration
2. ? Extract the target URL (`http://localhost:8080`) and authentication
3. ? Convert the mock to Wiremock mapping format
4. ? Send `POST http://localhost:8080/__admin/mappings` with Basic auth
5. ? Return deployment results

### Response:
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
        "id": "generated-uuid",
        "method": "GET",
        "url": "/webapi/OutageListData/GetDetailedPlannedOutages.*"
      }
    ]
  }
}
```

## Key Benefits:

1. **Automated Deployment**: No need to manually convert configs to Wiremock format
2. **Validation First**: Ensures configs are valid before deployment
3. **Batch Operations**: Deploy all mocks from config with one API call
4. **Authentication Support**: Works with secured Wiremock instances
5. **Error Handling**: Individual mapping failures don't stop entire deployment
6. **Logging**: Comprehensive logging for troubleshooting

## Equivalent to Your Postman Request:
Your original Postman request:
```
POST 'http://localhost:8080/__admin/mappings'
--header 'Authorization: Basic YWRtaW46YWRtaW4xMjM='
--header 'Content-Type: application/json'
--body '{...mapping...}'
```

Is now equivalent to:
```
POST '/api/config/validate-and-deploy' 
with ATOM config containing target.baseUrl and auth
```

The service automatically handles the authentication, URL construction, and mapping creation for all mocks in your config!