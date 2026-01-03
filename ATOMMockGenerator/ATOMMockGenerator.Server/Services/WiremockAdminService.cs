using ATOMMockGenerator.Server.Models;
using System.Text;
using System.Text.Json;

namespace ATOMMockGenerator.Server.Services
{
    public interface IWiremockAdminService
    {
        Task<WiremockMapping> CreateMappingAsync(string wiremockBaseUrl, WiremockMapping mapping, AuthConfig? auth = null);
        Task<List<WiremockMapping>> CreateMappingsAsync(string wiremockBaseUrl, List<WiremockMapping> mappings, AuthConfig? auth = null);
        Task<bool> DeleteMappingAsync(string wiremockBaseUrl, string mappingId, AuthConfig? auth = null);
        Task<List<WiremockMapping>> GetAllMappingsAsync(string wiremockBaseUrl, AuthConfig? auth = null);
        Task ResetMappingsAsync(string wiremockBaseUrl, AuthConfig? auth = null);
    }

    public class WiremockAdminService : IWiremockAdminService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<WiremockAdminService> _logger;

        public WiremockAdminService(HttpClient httpClient, ILogger<WiremockAdminService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<WiremockMapping> CreateMappingAsync(string wiremockBaseUrl, WiremockMapping mapping, AuthConfig? auth = null)
        {
            var url = $"{wiremockBaseUrl.TrimEnd('/')}/__admin/mappings";
            
            var json = JsonSerializer.Serialize(mapping, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });

            var content = new StringContent(json, Encoding.UTF8, "application/json");
            
            var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = content
            };

            // Add authentication if provided
            AddAuthenticationHeader(request, auth);

            try
            {
                var response = await _httpClient.SendAsync(request);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to create Wiremock mapping. Status: {StatusCode}, Content: {Content}", 
                        response.StatusCode, errorContent);
                    throw new HttpRequestException($"Failed to create Wiremock mapping: {response.StatusCode} - {errorContent}");
                }

                var responseContent = await response.Content.ReadAsStringAsync();
                var createdMapping = JsonSerializer.Deserialize<WiremockMapping>(responseContent, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    PropertyNameCaseInsensitive = true
                });

                _logger.LogInformation("Successfully created Wiremock mapping with ID: {MappingId}", createdMapping?.Id);
                return createdMapping ?? mapping;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while creating Wiremock mapping");
                throw;
            }
        }

        public async Task<List<WiremockMapping>> CreateMappingsAsync(string wiremockBaseUrl, List<WiremockMapping> mappings, AuthConfig? auth = null)
        {
            var createdMappings = new List<WiremockMapping>();
            var failures = new List<string>();

            _logger.LogInformation("Starting deployment of {MappingCount} mappings to {BaseUrl}", mappings.Count, wiremockBaseUrl);

            foreach (var mapping in mappings)
            {
                try
                {
                    var createdMapping = await CreateMappingAsync(wiremockBaseUrl, mapping, auth);
                    createdMappings.Add(createdMapping);
                    _logger.LogDebug("Successfully created mapping: {MappingId} - {Method} {Url}", 
                        createdMapping.Id, 
                        createdMapping.Request.Method, 
                        createdMapping.Request.Url ?? createdMapping.Request.UrlPattern);
                }
                catch (Exception ex)
                {
                    var mappingDescription = $"{mapping.Request.Method} {mapping.Request.Url ?? mapping.Request.UrlPattern}";
                    _logger.LogError(ex, "Failed to create mapping: {MappingDescription}", mappingDescription);
                    failures.Add($"{mappingDescription}: {ex.Message}");
                    // Continue with other mappings even if one fails
                }
            }

            _logger.LogInformation("Completed deployment: {SuccessCount}/{TotalCount} mappings created successfully", 
                createdMappings.Count, mappings.Count);

            if (failures.Any())
            {
                _logger.LogWarning("Failed to create {FailureCount} mappings: {Failures}", 
                    failures.Count, string.Join(", ", failures));
            }

            return createdMappings;
        }

        public async Task<bool> DeleteMappingAsync(string wiremockBaseUrl, string mappingId, AuthConfig? auth = null)
        {
            var url = $"{wiremockBaseUrl.TrimEnd('/')}/__admin/mappings/{mappingId}";
            
            var request = new HttpRequestMessage(HttpMethod.Delete, url);
            AddAuthenticationHeader(request, auth);

            try
            {
                var response = await _httpClient.SendAsync(request);
                
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Successfully deleted Wiremock mapping: {MappingId}", mappingId);
                    return true;
                }
                else
                {
                    _logger.LogWarning("Failed to delete Wiremock mapping {MappingId}: {StatusCode}", mappingId, response.StatusCode);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while deleting Wiremock mapping: {MappingId}", mappingId);
                return false;
            }
        }

        public async Task<List<WiremockMapping>> GetAllMappingsAsync(string wiremockBaseUrl, AuthConfig? auth = null)
        {
            var url = $"{wiremockBaseUrl.TrimEnd('/')}/__admin/mappings";
            
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            AddAuthenticationHeader(request, auth);

            try
            {
                var response = await _httpClient.SendAsync(request);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Failed to get Wiremock mappings. Status: {StatusCode}", response.StatusCode);
                    return new List<WiremockMapping>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var mappingsResponse = JsonSerializer.Deserialize<WiremockMappingsResponse>(content, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    PropertyNameCaseInsensitive = true
                });

                return mappingsResponse?.Mappings ?? new List<WiremockMapping>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while getting Wiremock mappings");
                return new List<WiremockMapping>();
            }
        }

        public async Task ResetMappingsAsync(string wiremockBaseUrl, AuthConfig? auth = null)
        {
            var url = $"{wiremockBaseUrl.TrimEnd('/')}/__admin/mappings/reset";
            
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            AddAuthenticationHeader(request, auth);

            try
            {
                var response = await _httpClient.SendAsync(request);
                
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Successfully reset all Wiremock mappings");
                }
                else
                {
                    _logger.LogWarning("Failed to reset Wiremock mappings: {StatusCode}", response.StatusCode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while resetting Wiremock mappings");
                throw;
            }
        }

        private void AddAuthenticationHeader(HttpRequestMessage request, AuthConfig? auth)
        {
            if (auth == null) return;

            switch (auth.Type?.ToLower())
            {
                case "basic":
                    if (!string.IsNullOrEmpty(auth.Username) && !string.IsNullOrEmpty(auth.Password))
                    {
                        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{auth.Username}:{auth.Password}"));
                        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", credentials);
                    }
                    break;
                case "bearer":
                    if (!string.IsNullOrEmpty(auth.Token))
                    {
                        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth.Token);
                    }
                    break;
            }
        }

        // Helper class for deserializing Wiremock's mappings response
        private class WiremockMappingsResponse
        {
            public List<WiremockMapping> Mappings { get; set; } = new();
        }
    }
}