using Microsoft.AspNetCore.Mvc;
using ATOMMockGenerator.Server.Models;
using ATOMMockGenerator.Server.Services;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace ATOMMockGenerator.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ConfigController : ControllerBase
    {
        private readonly IConfigValidationService _validationService;
        private readonly IMappingService _mappingService;
        private readonly IWiremockAdminService _wiremockAdminService;
        private readonly ILogger<ConfigController> _logger;

        public ConfigController(
            IConfigValidationService validationService, 
            IMappingService mappingService, 
            IWiremockAdminService wiremockAdminService,
            ILogger<ConfigController> logger)
        {
            _validationService = validationService;
            _mappingService = mappingService;
            _wiremockAdminService = wiremockAdminService;
            _logger = logger;
        }

        [HttpPost("validate")]
        public IActionResult ValidateConfig([FromBody] JsonElement configJson)
        {
            try
            {
                _logger.LogInformation("Received JSON for validation: {ConfigLength} characters", configJson.GetRawText().Length);
                
                var result = _validationService.ValidateConfigFromJson(configJson);
                _logger.LogInformation("Validation result: IsValid={IsValid}, Errors={ErrorCount}", result.IsValid, result.Errors.Count);
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Validation failed");
                
                return BadRequest(new ValidationResult
                {
                    IsValid = false,
                    Errors = new List<ValidationError> 
                    { 
                        new ValidationError { Path = "root", Message = $"Validation failed: {ex.Message}", Severity = "error" } 
                    }
                });
            }
        }

        [HttpPost("generate-mappings")]
        public async Task<IActionResult> GenerateMappings([FromBody] JsonElement configJson)
        {
            try
            {
                _logger.LogInformation("Received JSON for mapping generation: {ConfigLength} characters", configJson.GetRawText().Length);

                // First validate the config
                var validationResult = _validationService.ValidateConfigFromJson(configJson);
                
                if (!validationResult.IsValid)
                {
                    _logger.LogWarning("Configuration validation failed with {ErrorCount} errors", validationResult.Errors.Count);
                    return BadRequest(new { 
                        success = false, 
                        message = "Configuration validation failed",
                        validation = validationResult
                    });
                }

                // Configure JsonSerializer options for camelCase naming
                var options = new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    PropertyNameCaseInsensitive = true
                };

                // Determine config type and generate mappings
                var isAtomConfig = configJson.TryGetProperty("mocks", out var mocksProperty) && mocksProperty.ValueKind == JsonValueKind.Array;
                
                List<WiremockMapping> mappings;

                if (isAtomConfig)
                {
                    _logger.LogInformation("Processing ATOM config format");
                    var atomConfig = JsonSerializer.Deserialize<ATOMConfig>(configJson.GetRawText(), options);
                    if (atomConfig == null)
                    {
                        _logger.LogError("Failed to deserialize ATOM config");
                        return BadRequest(new { success = false, message = "Failed to deserialize ATOM config" });
                    }

                    mappings = await _mappingService.GenerateMappingsFromATOMAsync(atomConfig);
                }
                else
                {
                    _logger.LogInformation("Processing legacy config format");
                    var legacyConfig = JsonSerializer.Deserialize<JsonConfig>(configJson.GetRawText(), options);
                    if (legacyConfig == null)
                    {
                        _logger.LogError("Failed to deserialize legacy config");
                        return BadRequest(new { success = false, message = "Failed to deserialize legacy config" });
                    }

                    mappings = await _mappingService.GenerateMappingsAsync(legacyConfig);
                }

                _logger.LogInformation("Generated {MappingCount} mappings successfully", mappings.Count);

                return Ok(mappings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Mapping generation failed");
                
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Failed to generate mappings: {ex.Message}",
                    error = ex.Message
                });
            }
        }

        [HttpPost("validate-and-deploy")]
        public async Task<IActionResult> ValidateAndDeployConfig([FromBody] JsonElement configJson)
        {
            try
            {
                _logger.LogInformation("Received JSON for validation and deployment: {ConfigLength} characters", configJson.GetRawText().Length);
                
                // First validate the config
                var validationResult = _validationService.ValidateConfigFromJson(configJson);
                _logger.LogInformation("Validation result: IsValid={IsValid}, Errors={ErrorCount}", validationResult.IsValid, validationResult.Errors.Count);
                
                if (!validationResult.IsValid)
                {
                    _logger.LogWarning("Configuration validation failed, deployment aborted");
                    return BadRequest(new
                    {
                        success = false,
                        message = "Configuration validation failed",
                        validation = validationResult
                    });
                }

                // Configure JsonSerializer options for camelCase naming
                var options = new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    PropertyNameCaseInsensitive = true
                };

                // Determine config type and generate mappings
                var isAtomConfig = configJson.TryGetProperty("mocks", out var mocksProperty) && mocksProperty.ValueKind == JsonValueKind.Array;
                
                List<WiremockMapping> mappings;
                string targetBaseUrl;
                AuthConfig? authConfig = null;

                if (isAtomConfig)
                {
                    _logger.LogInformation("Processing ATOM config for deployment");
                    var atomConfig = JsonSerializer.Deserialize<ATOMConfig>(configJson.GetRawText(), options);
                    if (atomConfig == null)
                    {
                        _logger.LogError("Failed to deserialize ATOM config");
                        return BadRequest(new { success = false, message = "Failed to deserialize ATOM config" });
                    }

                    // Extract target configuration
                    if (atomConfig.Target == null || string.IsNullOrWhiteSpace(atomConfig.Target.BaseUrl))
                    {
                        _logger.LogError("Target baseUrl is missing in ATOM config");
                        return BadRequest(new { success = false, message = "Target baseUrl is required for ATOM config" });
                    }

                    targetBaseUrl = atomConfig.Target.BaseUrl;
                    authConfig = atomConfig.Target.Auth;
                    
                    mappings = await _mappingService.GenerateMappingsFromATOMAsync(atomConfig);
                }
                else
                {
                    _logger.LogInformation("Processing legacy config for deployment");
                    var legacyConfig = JsonSerializer.Deserialize<JsonConfig>(configJson.GetRawText(), options);
                    if (legacyConfig == null)
                    {
                        _logger.LogError("Failed to deserialize legacy config");
                        return BadRequest(new { success = false, message = "Failed to deserialize legacy config" });
                    }

                    // For legacy config, use baseUrl or default
                    targetBaseUrl = legacyConfig.BaseUrl ?? "http://localhost:8080";
                    
                    mappings = await _mappingService.GenerateMappingsAsync(legacyConfig);
                }

                _logger.LogInformation("Generated {MappingCount} mappings, deploying to {TargetUrl}", mappings.Count, targetBaseUrl);

                // Deploy mappings to Wiremock
                var deployedMappings = await _wiremockAdminService.CreateMappingsAsync(targetBaseUrl, mappings, authConfig);

                _logger.LogInformation("Successfully deployed {DeployedCount} mappings to {TargetUrl}", deployedMappings.Count, targetBaseUrl);

                var response = new
                {
                    success = true,
                    message = $"Successfully validated and deployed {deployedMappings.Count} mappings to {targetBaseUrl}",
                    validation = validationResult,
                    deployed = new
                    {
                        target = targetBaseUrl,
                        mappingsCount = deployedMappings.Count,
                        mappings = deployedMappings.Select(m => new { id = m.Id, method = m.Request.Method, url = m.Request.Url ?? m.Request.UrlPattern })
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Validation and deployment failed");
                
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Failed to validate and deploy config: {ex.Message}",
                    error = ex.Message
                });
            }
        }

        [HttpPost("deploy-mappings")]
        public async Task<IActionResult> DeployMappings([FromBody] DeployMappingsRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.TargetUrl))
                {
                    _logger.LogWarning("Deploy mappings request missing target URL");
                    return BadRequest(new { success = false, message = "Target URL is required" });
                }

                if (request.Mappings == null || !request.Mappings.Any())
                {
                    _logger.LogWarning("Deploy mappings request has no mappings");
                    return BadRequest(new { success = false, message = "At least one mapping is required" });
                }

                _logger.LogInformation("Deploying {MappingCount} mappings to {TargetUrl}", request.Mappings.Count, request.TargetUrl);

                // Deploy mappings to Wiremock
                var deployedMappings = await _wiremockAdminService.CreateMappingsAsync(request.TargetUrl, request.Mappings, request.Auth);

                _logger.LogInformation("Successfully deployed {DeployedCount} mappings to {TargetUrl}", deployedMappings.Count, request.TargetUrl);

                var response = new
                {
                    success = true,
                    message = $"Successfully deployed {deployedMappings.Count} mappings to {request.TargetUrl}",
                    deployed = new
                    {
                        target = request.TargetUrl,
                        mappingsCount = deployedMappings.Count,
                        mappings = deployedMappings.Select(m => new { id = m.Id, method = m.Request.Method, url = m.Request.Url ?? m.Request.UrlPattern })
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Deployment failed for target {TargetUrl}", request.TargetUrl);
                
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Failed to deploy mappings: {ex.Message}",
                    error = ex.Message
                });
            }
        }

        [HttpDelete("reset-wiremock")]
        public async Task<IActionResult> ResetWiremockMappings([FromBody] ResetWiremockRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.TargetUrl))
                {
                    _logger.LogWarning("Reset wiremock request missing target URL");
                    return BadRequest(new { success = false, message = "Target URL is required" });
                }

                _logger.LogInformation("Resetting all mappings on {TargetUrl}", request.TargetUrl);

                await _wiremockAdminService.ResetMappingsAsync(request.TargetUrl, request.Auth);

                _logger.LogInformation("Successfully reset all mappings on {TargetUrl}", request.TargetUrl);

                return Ok(new
                {
                    success = true,
                    message = $"Successfully reset all mappings on {request.TargetUrl}"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Reset failed for target {TargetUrl}", request.TargetUrl);
                
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Failed to reset mappings: {ex.Message}",
                    error = ex.Message
                });
            }
        }

        [HttpGet("template")]
        public IActionResult GetTemplate()
        {
            // Return the ATOM config template
            var template = new ATOMConfig
            {
                Version = "1.0",
                Target = new TargetConfig
                {
                    BaseUrl = "http://localhost:8080",
                    Auth = new AuthConfig
                    {
                        Type = "basic",
                        Username = "admin",
                        Password = "admin123"
                    }
                },
                Defaults = new DefaultsConfig
                {
                    Priority = 5,
                    Headers = new Dictionary<string, string>
                    {
                        { "Content-Type", "application/json" }
                    },
                    Templating = new TemplatingConfig { Enabled = false }
                },
                Mocks = new List<MockConfig>
                {
                    new MockConfig
                    {
                        Name = "Get planned outages",
                        Priority = 1,
                        Request = new MockRequest
                        {
                            Method = "GET",
                            UrlPattern = "/webapi/OutageListData/GetDetailedPlannedOutages.*"
                        },
                        Response = new MockResponse
                        {
                            Status = 200,
                            Headers = new Dictionary<string, string>
                            {
                                { "Content-Type", "application/json" }
                            },
                            Body = new ResponseBody
                            {
                                Type = "inline",
                                Value = "[{\"Area\":\"Berry Park, Duckenfield, Millers Forest, Morpeth\",\"Cause\":\"Replacing or fixing powerlines above ground in your neighbourhood\",\"Detail\":\"\",\"Customers\":\"79\",\"EndDateTime\":\"2025-06-19T16:00:00\",\"StartDateTime\":\"2025-06-19T08:00:00\",\"Status\":\"Proceeding as scheduled\",\"Reason\":null,\"Streets\":\"Duckenfield Rd, Duckenfield Wharf Rd, Eales Rd, McFarlanes Rd, Raymond Terrace Rd, Wharf Rd\",\"WebId\":80450,\"JobId\":\"120938\"}]"
                            }
                        }
                    },
                    new MockConfig
                    {
                        Name = "Get user by id",
                        Priority = 2,
                        Request = new MockRequest
                        {
                            Method = "GET",
                            UrlPath = "/users/{userId}",
                            PathTemplate = "/users/{userId}",
                            QueryParameters = new Dictionary<string, RequestMatcher>
                            {
                                { "verbose", new RequestMatcher { EqualTo = "true" } }
                            },
                            Headers = new Dictionary<string, RequestMatcher>
                            {
                                { "Accept", new RequestMatcher { Contains = "application/json" } }
                            }
                        },
                        Response = new MockResponse
                        {
                            Status = 200,
                            Headers = new Dictionary<string, string>
                            {
                                { "Content-Type", "application/json" }
                            },
                            Body = new ResponseBody
                            {
                                Type = "inline",
                                Value = "{ \"id\": \"{{request.pathSegments.[1]}}\", \"name\": \"John\" }",
                                Templating = true
                            },
                            FixedDelayMilliseconds = 100
                        },
                        Scenario = new ScenarioConfig
                        {
                            Name = "User lifecycle",
                            RequiredState = "Started",
                            NewState = "Fetched"
                        },
                        Metadata = new Dictionary<string, object>
                        {
                            { "owner", "team-a" },
                            { "jira", "ABC-123" }
                        }
                    },
                    new MockConfig
                    {
                        Name = "Create user",
                        Priority = 3,
                        Request = new MockRequest
                        {
                            Method = "POST",
                            UrlPath = "/users",
                            BodyPatterns = new List<RequestBodyPattern>
                            {
                                new RequestBodyPattern
                                {
                                    EqualToJson = new EqualToJsonPattern
                                    {
                                        Json = "{ \"role\": \"basic\" }",
                                        IgnoreExtraElements = true
                                    }
                                }
                            }
                        },
                        Response = new MockResponse
                        {
                            Status = 201,
                            Headers = new Dictionary<string, string>
                            {
                                { "Location", "/users/1001" }
                            },
                            Body = new ResponseBody
                            {
                                Type = "file",
                                FileName = "users/create-success.json"
                            }
                        }
                    }
                }
            };

            var json = JsonSerializer.Serialize(template, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            return File(System.Text.Encoding.UTF8.GetBytes(json), "application/json", "atom-config-template.json");
        }

        [HttpGet("template-legacy")]
        public IActionResult GetLegacyTemplate()
        {
            var template = new JsonConfig
            {
                Name = "Sample Wiremock Configuration",
                Version = "1.0.0",
                BaseUrl = "http://localhost:8080",
                Port = 8080,
                Mappings = new List<WiremockMapping>
                {
                    new WiremockMapping
                    {
                        Request = new WiremockRequest
                        {
                            Method = "GET",
                            Url = "/api/users"
                        },
                        Response = new WiremockResponse
                        {
                            Status = 200,
                            Headers = new Dictionary<string, string>
                            {
                                { "Content-Type", "application/json" }
                            },
                            Body = "[{\"id\": 1, \"name\": \"John Doe\", \"email\": \"john@example.com\"}]"
                        },
                        Priority = 1
                    },
                    new WiremockMapping
                    {
                        Request = new WiremockRequest
                        {
                            Method = "GET",
                            UrlPattern = "/api/users/([0-9]+)"
                        },
                        Response = new WiremockResponse
                        {
                            Status = 200,
                            Headers = new Dictionary<string, string>
                            {
                                { "Content-Type", "application/json" }
                            },
                            Body = "{\"id\": 1, \"name\": \"John Doe\", \"email\": \"john@example.com\"}"
                        },
                        Priority = 2
                    },
                    new WiremockMapping
                    {
                        Request = new WiremockRequest
                        {
                            Method = "POST",
                            Url = "/api/users"
                        },
                        Response = new WiremockResponse
                        {
                            Status = 201,
                            Headers = new Dictionary<string, string>
                            {
                                { "Content-Type", "application/json" },
                                { "Location", "/api/users/2" }
                            },
                            Body = "{\"id\": 2, \"name\": \"New User\", \"email\": \"newuser@example.com\"}"
                        },
                        Priority = 1
                    }
                }
            };

            var json = JsonSerializer.Serialize(template, new JsonSerializerOptions
            {
                WriteIndented = true
            });

            return File(System.Text.Encoding.UTF8.GetBytes(json), "application/json", "wiremock-config-template.json");
        }

        [HttpGet("example-usage")]
        public IActionResult GetExampleUsage()
        {
            var examples = new
            {
                description = "Examples of how to use the Wiremock integration endpoints",
                endpoints = new object[]
                {
                    new
                    {
                        name = "Validate and Deploy Config",
                        method = "POST",
                        url = "/api/config/validate-and-deploy",
                        description = "Validates ATOM config and deploys all mocks to Wiremock instance",
                        exampleRequest = new
                        {
                            version = "1.0",
                            target = new
                            {
                                baseUrl = "http://localhost:8080",
                                auth = new
                                {
                                    type = "basic",
                                    username = "admin",
                                    password = "admin123"
                                }
                            },
                            mocks = new object[]
                            {
                                new
                                {
                                    name = "Get planned outages",
                                    request = new
                                    {
                                        method = "GET",
                                        urlPattern = "/webapi/OutageListData/GetDetailedPlannedOutages.*"
                                    },
                                    response = new
                                    {
                                        status = 200,
                                        headers = new { ContentType = "application/json" },
                                        body = new
                                        {
                                            type = "inline",
                                            value = "[{\"Area\":\"Berry Park, Duckenfield, Millers Forest, Morpeth\",\"Cause\":\"Replacing or fixing powerlines above ground in your neighbourhood\",\"Detail\":\"\",\"Customers\":\"79\",\"EndDateTime\":\"2025-06-19T16:00:00\",\"StartDateTime\":\"2025-06-19T08:00:00\",\"Status\":\"Proceeding as scheduled\",\"Reason\":null,\"Streets\":\"Duckenfield Rd, Duckenfield Wharf Rd, Eales Rd, McFarlanes Rd, Raymond Terrace Rd, Wharf Rd\",\"WebId\":80450,\"JobId\":\"120938\"}]"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    new
                    {
                        name = "Reset Wiremock",
                        method = "DELETE",
                        url = "/api/config/reset-wiremock",
                        description = "Removes all mappings from Wiremock instance",
                        exampleRequest = new
                        {
                            targetUrl = "http://localhost:8080",
                            auth = new
                            {
                                type = "basic",
                                username = "admin",
                                password = "admin123"
                            }
                        }
                    }
                },
                curlExamples = new
                {
                    validateAndDeploy = "curl -X POST http://localhost:5000/api/config/validate-and-deploy \\\n  -H \"Content-Type: application/json\" \\\n  -d @atom-config.json",
                    resetWiremock = "curl -X DELETE http://localhost:5000/api/config/reset-wiremock \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"targetUrl\":\"http://localhost:8080\",\"auth\":{\"type\":\"basic\",\"username\":\"admin\",\"password\":\"admin123\"}}'"
                },
                wiremockEquivalent = new
                {
                    description = "This is equivalent to your Postman request",
                    originalPostmanRequest = "POST 'http://localhost:8080/__admin/mappings' --header 'Authorization: Basic YWRtaW46YWRtaW4xMjM=' --header 'Content-Type: application/json'",
                    atomGeneratorRequest = "POST '/api/config/validate-and-deploy' with ATOM config containing target.baseUrl and auth"
                }
            };

            return Ok(examples);
        }

        [HttpPost("get-wiremock-mappings")]
        public async Task<IActionResult> GetWiremockMappings([FromBody] GetMappingsRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.TargetUrl))
                {
                    _logger.LogWarning("Get mappings request missing target URL");
                    return BadRequest(new { success = false, message = "Target URL is required" });
                }

                _logger.LogInformation("Fetching mappings from {TargetUrl}", request.TargetUrl);

                // Get mappings from Wiremock
                var mappings = await _wiremockAdminService.GetAllMappingsAsync(request.TargetUrl, request.Auth);

                _logger.LogInformation("Successfully retrieved {MappingCount} mappings from {TargetUrl}", mappings.Count, request.TargetUrl);

                var response = new
                {
                    success = true,
                    mappings = mappings,
                    count = mappings.Count,
                    target = request.TargetUrl
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get mappings from {TargetUrl}", request.TargetUrl);
                
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Failed to get mappings: {ex.Message}",
                    error = ex.Message
                });
            }
        }
    }
}