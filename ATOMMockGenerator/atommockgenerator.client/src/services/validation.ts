import type { ATOMConfig, ValidationResult, ValidationError } from '../types/index.js';

// JSON Schema for ATOM Mock Generator
const ATOM_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AskNBN WireMock Builder",
  "type": "object",
  "required": ["version", "mocks"],
  "properties": {
    "version": { "type": "string" },
    "target": {
      "type": "object",
      "required": ["baseUrl"],
      "properties": {
        "baseUrl": { "type": "string", "format": "uri" },
        "auth": {
          "type": "object",
          "properties": {
            "type": { "enum": ["none", "basic", "bearer"] },
            "username": { "type": "string" },
            "password": { "type": "string" },
            "token": { "type": "string" }
          }
        }
      }
    },
    "defaults": {
      "type": "object",
      "properties": {
        "priority": { "type": "integer", "minimum": 1 },
        "headers": { "type": "object", "additionalProperties": { "type": "string" } },
        "templating": {
          "type": "object",
          "properties": { "enabled": { "type": "boolean" } }
        }
      }
    },
    "mocks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["request", "response"],
        "properties": {
          "name": { "type": "string" },
          "priority": { "type": "integer", "minimum": 1 },
          "request": {
            "type": "object",
            "required": ["method"],
            "properties": {
              "method": { "enum": ["GET","POST","PUT","DELETE","PATCH","HEAD","OPTIONS","ANY"] },
              "url": { "type": "string" },
              "urlPattern": { "type": "string" },
              "urlPath": { "type": "string" },
              "urlPathPattern": { "type": "string" },
              "pathTemplate": { "type": "string" },
              "queryParameters": {
                "type": "object",
                "additionalProperties": {
                  "type": "object",
                  "properties": {
                    "equalTo": { "type": "string" },
                    "contains": { "type": "string" },
                    "matches": { "type": "string" }
                  }
                }
              },
              "headers": { "$ref": "#/$defs/requestMatcherMap" },
              "cookies": { "$ref": "#/$defs/requestMatcherMap" },
              "bodyPatterns": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "equalToJson": {
                      "type": "object",
                      "properties": {
                        "json": { "type": "string" },
                        "ignoreExtraElements": { "type": "boolean" },
                        "ignoreArrayOrder": { "type": "boolean" }
                      }
                    },
                    "matchesJsonPath": { "type": "string" }
                  }
                }
              }
            }
          },
          "response": {
            "type": "object",
            "required": ["status"],
            "properties": {
              "status": { "type": "integer" },
              "headers": { "type": "object", "additionalProperties": { "type": "string" } },
              "fixedDelayMilliseconds": { "type": "integer", "minimum": 0 },
              "proxyBaseUrl": { "type": "string", "format": "uri" },
              "body": {
                "type": "object",
                "properties": {
                  "type": { "enum": ["inline","file"] },
                  "value": { "type": "string" },
                  "fileName": { "type": "string" },
                  "templating": { "type": "boolean" }
                },
                "oneOf": [
                  { "properties": { "type": { "const": "inline" }, "value": { "type": "string" } }, "required": ["type","value"] },
                  { "properties": { "type": { "const": "file" }, "fileName": { "type": "string" } }, "required": ["type","fileName"] }
                ]
              }
            }
          },
          "scenario": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "requiredState": { "type": "string" },
              "newState": { "type": "string" }
            }
          },
          "metadata": { "type": "object" }
        }
      }
    }
  },
  "$defs": {
    "requestMatcherMap": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "equalTo": { "type": "string" },
          "contains": { "type": "string" },
          "matches": { "type": "string" }
        }
      }
    }
  }
} as const;

type JSONSchemaType = typeof ATOM_SCHEMA;

// Simple JSON Schema validator implementation
class SimpleValidator {
  validate(data: unknown, schema: JSONSchemaType, path = ''): ValidationError[] {
    const errors: ValidationError[] = [];

    if (schema.type) {
      if (schema.type === 'object' && typeof data !== 'object') {
        errors.push({ path, message: `Expected object, got ${typeof data}`, severity: 'error' });
        return errors;
      }
      if (schema.type === 'array' && !Array.isArray(data)) {
        errors.push({ path, message: `Expected array, got ${typeof data}`, severity: 'error' });
        return errors;
      }
      if (schema.type === 'string' && typeof data !== 'string') {
        errors.push({ path, message: `Expected string, got ${typeof data}`, severity: 'error' });
        return errors;
      }
      if (schema.type === 'integer' && (!Number.isInteger(data))) {
        errors.push({ path, message: `Expected integer, got ${typeof data}`, severity: 'error' });
        return errors;
      }
      if (schema.type === 'boolean' && typeof data !== 'boolean') {
        errors.push({ path, message: `Expected boolean, got ${typeof data}`, severity: 'error' });
        return errors;
      }
    }

    // Check required properties
    if ('required' in schema && schema.required && schema.type === 'object') {
      const reqArray = schema.required as string[];
      for (const reqProp of reqArray) {
        if (data === null || data === undefined || !(reqProp in (data as Record<string, unknown>))) {
          errors.push({ path: `${path}.${reqProp}`, message: `Required property '${reqProp}' is missing`, severity: 'error' });
        }
      }
    }

    // Check enum values
    if ('enum' in schema && schema.enum && !(schema.enum as unknown[]).includes(data)) {
      errors.push({ path, message: `Value '${data}' is not allowed. Expected one of: ${(schema.enum as unknown[]).join(', ')}`, severity: 'error' });
    }

    // Check minimum for integers
    if ('minimum' in schema && schema.minimum !== undefined && typeof data === 'number' && data < schema.minimum) {
      errors.push({ path, message: `Value ${data} is less than minimum ${schema.minimum}`, severity: 'error' });
    }

    // Check format for URIs
    if ('format' in schema && schema.format === 'uri' && typeof data === 'string') {
      try {
        new URL(data);
      } catch {
        errors.push({ path, message: `Invalid URI format: ${data}`, severity: 'error' });
      }
    }

    // Validate object properties
    if ('properties' in schema && schema.properties && typeof data === 'object' && data !== null) {
      const objData = data as Record<string, unknown>;
      const props = schema.properties as Record<string, unknown>;
      for (const [key, value] of Object.entries(objData)) {
        if (props[key]) {
          errors.push(...this.validate(value, props[key] as JSONSchemaType, path ? `${path}.${key}` : key));
        }
      }
    }

    // Validate array items
    if ('items' in schema && schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        errors.push(...this.validate(item, schema.items as JSONSchemaType, `${path}[${index}]`));
      });
    }

    // Handle additionalProperties for maps
    if ('additionalProperties' in schema && schema.additionalProperties && typeof data === 'object' && data !== null) {
      const objData = data as Record<string, unknown>;
      const props = ('properties' in schema && schema.properties) ? schema.properties as Record<string, unknown> : {};
      for (const [key, value] of Object.entries(objData)) {
        if (!props[key]) {
          errors.push(...this.validate(value, schema.additionalProperties as JSONSchemaType, path ? `${path}.${key}` : key));
        }
      }
    }

    // Handle oneOf validation for response body
    if ('oneOf' in schema && schema.oneOf && Array.isArray(schema.oneOf)) {
      const matchingSchemas = (schema.oneOf as JSONSchemaType[]).filter(subSchema => {
        const subErrors = this.validate(data, subSchema, path);
        return subErrors.length === 0;
      });

      if (matchingSchemas.length === 0) {
        errors.push({ path, message: 'Data does not match any of the required schemas', severity: 'error' });
      } else if (matchingSchemas.length > 1) {
        errors.push({ path, message: 'Data matches multiple schemas when only one is allowed', severity: 'error' });
      }
    }

    return errors;
  }
}

export class ValidationService {
  private validator = new SimpleValidator();

  validateATOMConfig(config: unknown): ValidationResult {
    try {
      // Basic JSON structure check
      if (!config || typeof config !== 'object') {
        return {
          isValid: false,
          errors: [{ path: 'root', message: 'Invalid JSON structure', severity: 'error' }],
          warnings: []
        };
      }

      // Schema validation
      const errors = this.validator.validate(config, ATOM_SCHEMA);
      
      // Additional business logic validation
      const businessErrors = this.validateBusinessLogic(config as ATOMConfig);
      const allErrors = [...errors, ...businessErrors];

      // Separate errors and warnings
      const errorList = allErrors.filter(e => e.severity === 'error');
      const warningList = allErrors.filter(e => e.severity === 'warning');

      return {
        isValid: errorList.length === 0,
        errors: errorList,
        warnings: warningList
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ path: 'root', message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`, severity: 'error' }],
        warnings: []
      };
    }
  }

  private validateBusinessLogic(config: ATOMConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate that each mock has at least one URL matching property
    config.mocks?.forEach((mock, index) => {
      const request = mock.request;
      const hasUrlMatch = !!(request.url || request.urlPattern || request.urlPath || request.urlPathPattern || request.pathTemplate);
      
      if (!hasUrlMatch) {
        errors.push({
          path: `mocks[${index}].request`,
          message: 'Request must have at least one URL matching property (url, urlPattern, urlPath, urlPathPattern, or pathTemplate)',
          severity: 'warning'
        });
      }

      // Validate response status codes
      if (mock.response.status < 100 || mock.response.status >= 600) {
        errors.push({
          path: `mocks[${index}].response.status`,
          message: `Invalid HTTP status code: ${mock.response.status}. Must be between 100-599`,
          severity: 'error'
        });
      }

      // Validate response body consistency
      if (mock.response.body) {
        const body = mock.response.body;
        if (body.type === 'inline' && !body.value) {
          errors.push({
            path: `mocks[${index}].response.body`,
            message: 'Inline response body must have a value',
            severity: 'error'
          });
        }
        if (body.type === 'file' && !body.fileName) {
          errors.push({
            path: `mocks[${index}].response.body`,
            message: 'File response body must have a fileName',
            severity: 'error'
          });
        }
      }

      // Validate auth configuration
      if (config.target?.auth) {
        const auth = config.target.auth;
        if (auth.type === 'basic' && (!auth.username || !auth.password)) {
          errors.push({
            path: 'target.auth',
            message: 'Basic authentication requires both username and password',
            severity: 'error'
          });
        }
        if (auth.type === 'bearer' && !auth.token) {
          errors.push({
            path: 'target.auth',
            message: 'Bearer authentication requires a token',
            severity: 'error'
          });
        }
      }

      // Check for potential conflicts in URL patterns
      if (request.url && (request.urlPattern || request.urlPath || request.urlPathPattern)) {
        errors.push({
          path: `mocks[${index}].request`,
          message: 'Using both exact URL and URL patterns may cause conflicts',
          severity: 'warning'
        });
      }
    });

    return errors;
  }
}

export const validationService = new ValidationService();