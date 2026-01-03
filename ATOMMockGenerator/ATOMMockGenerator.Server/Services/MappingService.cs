using ATOMMockGenerator.Server.Models;
using System.Collections.Concurrent;

namespace ATOMMockGenerator.Server.Services
{
    public interface IMappingService
    {
        Task<List<WiremockMapping>> GetAllMappingsAsync();
        Task<WiremockMapping?> GetMappingAsync(string id);
        Task<WiremockMapping> CreateMappingAsync(WiremockMapping mapping);
        Task<WiremockMapping> UpdateMappingAsync(string id, WiremockMapping mapping);
        Task<bool> DeleteMappingAsync(string id);
        Task<List<WiremockMapping>> GenerateMappingsAsync(JsonConfig config);
        Task<List<WiremockMapping>> GenerateMappingsFromATOMAsync(ATOMConfig config);
        Task<byte[]> ExportMappingsAsync(List<string> mappingIds);
    }

    public class MappingService : IMappingService
    {
        // In-memory storage for demo purposes
        // In a real application, you would use a database or external API
        private readonly ConcurrentDictionary<string, WiremockMapping> _mappings = new();

        public Task<List<WiremockMapping>> GetAllMappingsAsync()
        {
            return Task.FromResult(_mappings.Values.ToList());
        }

        public Task<WiremockMapping?> GetMappingAsync(string id)
        {
            _mappings.TryGetValue(id, out var mapping);
            return Task.FromResult(mapping);
        }

        public Task<WiremockMapping> CreateMappingAsync(WiremockMapping mapping)
        {
            mapping.Id = Guid.NewGuid().ToString();
            _mappings[mapping.Id] = mapping;
            return Task.FromResult(mapping);
        }

        public Task<WiremockMapping> UpdateMappingAsync(string id, WiremockMapping mapping)
        {
            mapping.Id = id;
            _mappings[id] = mapping;
            return Task.FromResult(mapping);
        }

        public Task<bool> DeleteMappingAsync(string id)
        {
            return Task.FromResult(_mappings.TryRemove(id, out _));
        }

        public async Task<List<WiremockMapping>> GenerateMappingsAsync(JsonConfig config)
        {
            var generatedMappings = new List<WiremockMapping>();

            foreach (var mapping in config.Mappings)
            {
                // Ensure mapping has an ID
                if (string.IsNullOrWhiteSpace(mapping.Id))
                {
                    mapping.Id = Guid.NewGuid().ToString();
                }

                // Store the mapping
                await CreateMappingAsync(mapping);
                generatedMappings.Add(mapping);
            }

            return generatedMappings;
        }

        public async Task<List<WiremockMapping>> GenerateMappingsFromATOMAsync(ATOMConfig config)
        {
            var generatedMappings = new List<WiremockMapping>();

            foreach (var mock in config.Mocks)
            {
                var wiremockMapping = ConvertToWiremockMapping(mock, config);
                
                // Store the mapping
                await CreateMappingAsync(wiremockMapping);
                generatedMappings.Add(wiremockMapping);
            }

            return generatedMappings;
        }

        private WiremockMapping ConvertToWiremockMapping(MockConfig mock, ATOMConfig config)
        {
            var mapping = new WiremockMapping
            {
                Id = Guid.NewGuid().ToString(),
                Priority = mock.Priority ?? config.Defaults?.Priority,
                ScenarioName = mock.Scenario?.Name,
                RequiredScenarioState = mock.Scenario?.RequiredState,
                NewScenarioState = mock.Scenario?.NewState
            };

            // Convert request
            mapping.Request = new WiremockRequest
            {
                Method = mock.Request.Method
            };

            // Set URL matching - prioritize in order: Url, UrlPattern, UrlPath, UrlPathPattern
            if (!string.IsNullOrWhiteSpace(mock.Request.Url))
            {
                mapping.Request.Url = mock.Request.Url;
            }
            else if (!string.IsNullOrWhiteSpace(mock.Request.UrlPattern))
            {
                mapping.Request.UrlPattern = mock.Request.UrlPattern;
            }
            else if (!string.IsNullOrWhiteSpace(mock.Request.UrlPath))
            {
                mapping.Request.Url = mock.Request.UrlPath;
            }
            else if (!string.IsNullOrWhiteSpace(mock.Request.UrlPathPattern))
            {
                mapping.Request.UrlPattern = mock.Request.UrlPathPattern;
            }
            else if (!string.IsNullOrWhiteSpace(mock.Request.PathTemplate))
            {
                // Convert path template to URL pattern (basic conversion)
                var pattern = mock.Request.PathTemplate.Replace("{", "([^/]+)").Replace("}", "");
                mapping.Request.UrlPattern = pattern;
            }

            // Convert headers - combine with defaults
            var headers = new Dictionary<string, object>();
            
            // Add default headers if they exist
            if (config.Defaults?.Headers != null)
            {
                foreach (var header in config.Defaults.Headers)
                {
                    headers[header.Key] = new { equalTo = header.Value };
                }
            }

            // Add request-specific headers
            if (mock.Request.Headers != null)
            {
                foreach (var header in mock.Request.Headers)
                {
                    var headerMatcher = new Dictionary<string, string>();
                    if (!string.IsNullOrWhiteSpace(header.Value.EqualTo))
                        headerMatcher["equalTo"] = header.Value.EqualTo;
                    if (!string.IsNullOrWhiteSpace(header.Value.Contains))
                        headerMatcher["contains"] = header.Value.Contains;
                    if (!string.IsNullOrWhiteSpace(header.Value.Matches))
                        headerMatcher["matches"] = header.Value.Matches;

                    headers[header.Key] = headerMatcher;
                }
            }

            if (headers.Count > 0)
            {
                mapping.Request.Headers = headers;
            }

            // Convert body patterns
            if (mock.Request.BodyPatterns != null && mock.Request.BodyPatterns.Count > 0)
            {
                mapping.Request.BodyPatterns = new List<object>();
                
                foreach (var pattern in mock.Request.BodyPatterns)
                {
                    if (pattern.EqualToJson != null)
                    {
                        var bodyPattern = new Dictionary<string, object>
                        {
                            ["equalToJson"] = pattern.EqualToJson.Json
                        };

                        if (pattern.EqualToJson.IgnoreExtraElements.HasValue)
                            bodyPattern["ignoreExtraElements"] = pattern.EqualToJson.IgnoreExtraElements.Value;
                        if (pattern.EqualToJson.IgnoreArrayOrder.HasValue)
                            bodyPattern["ignoreArrayOrder"] = pattern.EqualToJson.IgnoreArrayOrder.Value;

                        mapping.Request.BodyPatterns.Add(bodyPattern);
                    }
                    else if (!string.IsNullOrWhiteSpace(pattern.MatchesJsonPath))
                    {
                        mapping.Request.BodyPatterns.Add(new { matchesJsonPath = pattern.MatchesJsonPath });
                    }
                }
            }

            // Convert response
            mapping.Response = new WiremockResponse
            {
                Status = mock.Response.Status
            };

            // Combine response headers with defaults
            var responseHeaders = new Dictionary<string, string>();
            
            // Add default headers
            if (config.Defaults?.Headers != null)
            {
                foreach (var header in config.Defaults.Headers)
                {
                    responseHeaders[header.Key] = header.Value;
                }
            }

            // Add response-specific headers
            if (mock.Response.Headers != null)
            {
                foreach (var header in mock.Response.Headers)
                {
                    responseHeaders[header.Key] = header.Value;
                }
            }

            if (responseHeaders.Count > 0)
            {
                mapping.Response.Headers = responseHeaders;
            }

            // Convert response body
            if (mock.Response.Body != null)
            {
                if (mock.Response.Body.Type == "inline")
                {
                    mapping.Response.Body = mock.Response.Body.Value;
                }
                else if (mock.Response.Body.Type == "file")
                {
                    mapping.Response.BodyFileName = mock.Response.Body.FileName;
                }
            }

            return mapping;
        }

        public Task<byte[]> ExportMappingsAsync(List<string> mappingIds)
        {
            // In a real implementation, you would create a ZIP file with JSON files
            // For now, we'll return a simple JSON array
            var mappings = mappingIds
                .Select(id => _mappings.TryGetValue(id, out var mapping) ? mapping : null)
                .Where(m => m != null)
                .ToList();

            var json = System.Text.Json.JsonSerializer.Serialize(mappings, new System.Text.Json.JsonSerializerOptions
            {
                WriteIndented = true
            });

            return Task.FromResult(System.Text.Encoding.UTF8.GetBytes(json));
        }
    }
}