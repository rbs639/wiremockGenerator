using ATOMMockGenerator.Server.Models;
using System.Text.Json;

namespace ATOMMockGenerator.Server.Services
{
    public interface IConfigValidationService
    {
        ValidationResult ValidateConfig(JsonConfig config);
        ValidationResult ValidateATOMConfig(ATOMConfig config);
        ValidationResult ValidateConfigFromJson(JsonElement jsonElement);
    }

    public class ConfigValidationService : IConfigValidationService
    {
        public ValidationResult ValidateConfig(JsonConfig config)
        {
            var errors = new List<ValidationError>();
            var warnings = new List<ValidationError>();

            // Basic validation
            if (string.IsNullOrWhiteSpace(config.Name))
            {
                errors.Add(new ValidationError 
                { 
                    Path = "name", 
                    Message = "Configuration name is required", 
                    Severity = "error" 
                });
            }

            if (string.IsNullOrWhiteSpace(config.Version))
            {
                warnings.Add(new ValidationError 
                { 
                    Path = "version", 
                    Message = "Configuration version is recommended", 
                    Severity = "warning" 
                });
            }

            if (config.Mappings == null || config.Mappings.Count == 0)
            {
                errors.Add(new ValidationError 
                { 
                    Path = "mappings", 
                    Message = "At least one mapping is required", 
                    Severity = "error" 
                });
            }
            else
            {
                for (int i = 0; i < config.Mappings.Count; i++)
                {
                    var mapping = config.Mappings[i];
                    var pathPrefix = $"mappings[{i}]";

                    // Validate request
                    if (string.IsNullOrWhiteSpace(mapping.Request.Method))
                    {
                        errors.Add(new ValidationError 
                        { 
                            Path = $"{pathPrefix}.request.method", 
                            Message = "HTTP method is required", 
                            Severity = "error" 
                        });
                    }

                    if (string.IsNullOrWhiteSpace(mapping.Request.Url) && 
                        string.IsNullOrWhiteSpace(mapping.Request.UrlPattern))
                    {
                        errors.Add(new ValidationError 
                        { 
                            Path = $"{pathPrefix}.request", 
                            Message = "Either URL or URL pattern is required", 
                            Severity = "error" 
                        });
                    }

                    if (!string.IsNullOrWhiteSpace(mapping.Request.Url) && 
                        !string.IsNullOrWhiteSpace(mapping.Request.UrlPattern))
                    {
                        warnings.Add(new ValidationError 
                        { 
                            Path = $"{pathPrefix}.request", 
                            Message = "Both URL and URL pattern specified, URL pattern will take precedence", 
                            Severity = "warning" 
                        });
                    }

                    // Validate response
                    if (mapping.Response.Status < 100 || mapping.Response.Status > 599)
                    {
                        errors.Add(new ValidationError 
                        { 
                            Path = $"{pathPrefix}.response.status", 
                            Message = $"HTTP status code must be between 100 and 599, got {mapping.Response.Status}", 
                            Severity = "error" 
                        });
                    }

                    // Check for conflicting response body types
                    var bodyCount = 0;
                    if (!string.IsNullOrWhiteSpace(mapping.Response.Body)) bodyCount++;
                    if (mapping.Response.JsonBody.HasValue) bodyCount++;
                    if (!string.IsNullOrWhiteSpace(mapping.Response.BodyFileName)) bodyCount++;

                    if (bodyCount > 1)
                    {
                        warnings.Add(new ValidationError 
                        { 
                            Path = $"{pathPrefix}.response", 
                            Message = "Multiple response body types specified, only one will be used", 
                            Severity = "warning" 
                        });
                    }
                }
            }

            return new ValidationResult
            {
                IsValid = errors.Count == 0,
                Errors = errors,
                Warnings = warnings
            };
        }

        public ValidationResult ValidateATOMConfig(ATOMConfig config)
        {
            var errors = new List<ValidationError>();
            var warnings = new List<ValidationError>();

            // Basic validation
            if (string.IsNullOrWhiteSpace(config.Version))
            {
                errors.Add(new ValidationError 
                { 
                    Path = "version", 
                    Message = "Version is required", 
                    Severity = "error" 
                });
            }

            if (config.Mocks == null || config.Mocks.Count == 0)
            {
                errors.Add(new ValidationError 
                { 
                    Path = "mocks", 
                    Message = "At least one mock is required", 
                    Severity = "error" 
                });
            }
            else
            {
                for (int i = 0; i < config.Mocks.Count; i++)
                {
                    var mock = config.Mocks[i];
                    var pathPrefix = $"mocks[{i}]";

                    // Validate request
                    if (string.IsNullOrWhiteSpace(mock.Request.Method))
                    {
                        errors.Add(new ValidationError 
                        { 
                            Path = $"{pathPrefix}.request.method", 
                            Message = "HTTP method is required", 
                            Severity = "error" 
                        });
                    }
                    else
                    {
                        var validMethods = new[] { "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "ANY" };
                        if (!validMethods.Contains(mock.Request.Method.ToUpper()))
                        {
                            errors.Add(new ValidationError 
                            { 
                                Path = $"{pathPrefix}.request.method", 
                                Message = $"Invalid HTTP method: {mock.Request.Method}. Valid methods: {string.Join(", ", validMethods)}", 
                                Severity = "error" 
                            });
                        }
                    }

                    // Validate URL matching
                    var hasUrlMatch = !string.IsNullOrWhiteSpace(mock.Request.Url) ||
                                     !string.IsNullOrWhiteSpace(mock.Request.UrlPattern) ||
                                     !string.IsNullOrWhiteSpace(mock.Request.UrlPath) ||
                                     !string.IsNullOrWhiteSpace(mock.Request.UrlPathPattern) ||
                                     !string.IsNullOrWhiteSpace(mock.Request.PathTemplate);

                    if (!hasUrlMatch)
                    {
                        warnings.Add(new ValidationError 
                        { 
                            Path = $"{pathPrefix}.request", 
                            Message = "Request should have at least one URL matching property", 
                            Severity = "warning" 
                        });
                    }

                    // Check for potential URL conflicts
                    if (!string.IsNullOrWhiteSpace(mock.Request.Url) && 
                        (!string.IsNullOrWhiteSpace(mock.Request.UrlPattern) || 
                         !string.IsNullOrWhiteSpace(mock.Request.UrlPath) || 
                         !string.IsNullOrWhiteSpace(mock.Request.UrlPathPattern)))
                    {
                        warnings.Add(new ValidationError 
                        { 
                            Path = $"{pathPrefix}.request", 
                            Message = "Using both exact URL and URL patterns may cause conflicts", 
                            Severity = "warning" 
                        });
                    }

                    // Validate response
                    if (mock.Response.Status < 100 || mock.Response.Status >= 600)
                    {
                        errors.Add(new ValidationError 
                        { 
                            Path = $"{pathPrefix}.response.status", 
                            Message = $"Invalid HTTP status code: {mock.Response.Status}. Must be between 100-599", 
                            Severity = "error" 
                        });
                    }

                    // Validate response body
                    if (mock.Response.Body != null)
                    {
                        if (mock.Response.Body.Type == "inline" && string.IsNullOrWhiteSpace(mock.Response.Body.Value))
                        {
                            errors.Add(new ValidationError 
                            { 
                                Path = $"{pathPrefix}.response.body", 
                                Message = "Inline response body must have a value", 
                                Severity = "error" 
                            });
                        }

                        if (mock.Response.Body.Type == "file" && string.IsNullOrWhiteSpace(mock.Response.Body.FileName))
                        {
                            errors.Add(new ValidationError 
                            { 
                                Path = $"{pathPrefix}.response.body", 
                                Message = "File response body must have a fileName", 
                                Severity = "error" 
                            });
                        }

                        if (mock.Response.Body.Type != "inline" && mock.Response.Body.Type != "file")
                        {
                            errors.Add(new ValidationError 
                            { 
                                Path = $"{pathPrefix}.response.body.type", 
                                Message = "Response body type must be 'inline' or 'file'", 
                                Severity = "error" 
                            });
                        }
                    }

                    // Validate delay
                    if (mock.Response.FixedDelayMilliseconds.HasValue && mock.Response.FixedDelayMilliseconds < 0)
                    {
                        errors.Add(new ValidationError 
                        { 
                            Path = $"{pathPrefix}.response.fixedDelayMilliseconds", 
                            Message = "Fixed delay must be non-negative", 
                            Severity = "error" 
                        });
                    }

                    // Validate proxy URL
                    if (!string.IsNullOrWhiteSpace(mock.Response.ProxyBaseUrl))
                    {
                        if (!Uri.TryCreate(mock.Response.ProxyBaseUrl, UriKind.Absolute, out _))
                        {
                            errors.Add(new ValidationError 
                            { 
                                Path = $"{pathPrefix}.response.proxyBaseUrl", 
                                Message = $"Invalid proxy base URL format: {mock.Response.ProxyBaseUrl}", 
                                Severity = "error" 
                            });
                        }
                    }
                }
            }

            // Validate target configuration
            if (config.Target != null)
            {
                if (string.IsNullOrWhiteSpace(config.Target.BaseUrl))
                {
                    errors.Add(new ValidationError 
                    { 
                        Path = "target.baseUrl", 
                        Message = "Target base URL is required when target is specified", 
                        Severity = "error" 
                    });
                }
                else if (!Uri.TryCreate(config.Target.BaseUrl, UriKind.Absolute, out _))
                {
                    errors.Add(new ValidationError 
                    { 
                        Path = "target.baseUrl", 
                        Message = $"Invalid base URL format: {config.Target.BaseUrl}", 
                        Severity = "error" 
                    });
                }

                // Validate auth configuration
                if (config.Target.Auth != null)
                {
                    var validAuthTypes = new[] { "none", "basic", "bearer" };
                    if (!validAuthTypes.Contains(config.Target.Auth.Type.ToLower()))
                    {
                        errors.Add(new ValidationError 
                        { 
                            Path = "target.auth.type", 
                            Message = $"Invalid auth type: {config.Target.Auth.Type}. Valid types: {string.Join(", ", validAuthTypes)}", 
                            Severity = "error" 
                        });
                    }

                    if (config.Target.Auth.Type.ToLower() == "basic")
                    {
                        if (string.IsNullOrWhiteSpace(config.Target.Auth.Username) || 
                            string.IsNullOrWhiteSpace(config.Target.Auth.Password))
                        {
                            errors.Add(new ValidationError 
                            { 
                                Path = "target.auth", 
                                Message = "Basic authentication requires both username and password", 
                                Severity = "error" 
                            });
                        }
                    }

                    if (config.Target.Auth.Type.ToLower() == "bearer")
                    {
                        if (string.IsNullOrWhiteSpace(config.Target.Auth.Token))
                        {
                            errors.Add(new ValidationError 
                            { 
                                Path = "target.auth", 
                                Message = "Bearer authentication requires a token", 
                                Severity = "error" 
                            });
                        }
                    }
                }
            }

            // Validate defaults
            if (config.Defaults?.Priority.HasValue == true && config.Defaults.Priority < 1)
            {
                errors.Add(new ValidationError 
                { 
                    Path = "defaults.priority", 
                    Message = "Default priority must be 1 or greater", 
                    Severity = "error" 
                });
            }

            return new ValidationResult
            {
                IsValid = errors.Count == 0,
                Errors = errors,
                Warnings = warnings
            };
        }

        public ValidationResult ValidateConfigFromJson(JsonElement jsonElement)
        {
            try
            {
                // Try to determine if this is an ATOM config or legacy config
                var isAtomConfig = jsonElement.TryGetProperty("mocks", out var mocksProperty) && mocksProperty.ValueKind == JsonValueKind.Array;
                
                // Configure JsonSerializer options for camelCase naming
                var options = new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    PropertyNameCaseInsensitive = true
                };
                
                if (isAtomConfig)
                {
                    var atomConfig = JsonSerializer.Deserialize<ATOMConfig>(jsonElement.GetRawText(), options);
                    return atomConfig != null ? ValidateATOMConfig(atomConfig) : 
                        new ValidationResult 
                        { 
                            IsValid = false, 
                            Errors = new List<ValidationError> 
                            { 
                                new ValidationError { Path = "root", Message = "Failed to deserialize ATOM config", Severity = "error" } 
                            } 
                        };
                }
                else
                {
                    var legacyConfig = JsonSerializer.Deserialize<JsonConfig>(jsonElement.GetRawText(), options);
                    return legacyConfig != null ? ValidateConfig(legacyConfig) : 
                        new ValidationResult 
                        { 
                            IsValid = false, 
                            Errors = new List<ValidationError> 
                            { 
                                new ValidationError { Path = "root", Message = "Failed to deserialize legacy config", Severity = "error" } 
                            } 
                        };
                }
            }
            catch (JsonException ex)
            {
                return new ValidationResult
                {
                    IsValid = false,
                    Errors = new List<ValidationError>
                    {
                        new ValidationError { Path = "root", Message = $"JSON parsing error: {ex.Message}", Severity = "error" }
                    }
                };
            }
            catch (Exception ex)
            {
                return new ValidationResult
                {
                    IsValid = false,
                    Errors = new List<ValidationError>
                    {
                        new ValidationError { Path = "root", Message = $"Validation error: {ex.Message}", Severity = "error" }
                    }
                };
            }
        }
    }
}