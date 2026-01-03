using Microsoft.AspNetCore.Mvc;
using ATOMMockGenerator.Server.Models;
using ATOMMockGenerator.Server.Services;

namespace ATOMMockGenerator.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MappingsController : ControllerBase
    {
        private readonly IMappingService _mappingService;

        public MappingsController(IMappingService mappingService)
        {
            _mappingService = mappingService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllMappings()
        {
            try
            {
                var mappings = await _mappingService.GetAllMappingsAsync();
                return Ok(mappings);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to retrieve mappings: {ex.Message}" });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetMapping(string id)
        {
            try
            {
                var mapping = await _mappingService.GetMappingAsync(id);
                if (mapping == null)
                {
                    return NotFound(new { error = "Mapping not found" });
                }
                return Ok(mapping);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to retrieve mapping: {ex.Message}" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateMapping([FromBody] WiremockMapping mapping)
        {
            try
            {
                var createdMapping = await _mappingService.CreateMappingAsync(mapping);
                return CreatedAtAction(nameof(GetMapping), new { id = createdMapping.Id }, createdMapping);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to create mapping: {ex.Message}" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateMapping(string id, [FromBody] WiremockMapping mapping)
        {
            try
            {
                var existingMapping = await _mappingService.GetMappingAsync(id);
                if (existingMapping == null)
                {
                    return NotFound(new { error = "Mapping not found" });
                }

                var updatedMapping = await _mappingService.UpdateMappingAsync(id, mapping);
                return Ok(updatedMapping);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to update mapping: {ex.Message}" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMapping(string id)
        {
            try
            {
                var success = await _mappingService.DeleteMappingAsync(id);
                if (!success)
                {
                    return NotFound(new { error = "Mapping not found" });
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to delete mapping: {ex.Message}" });
            }
        }

        [HttpPost("download")]
        public async Task<IActionResult> DownloadMappings([FromBody] DownloadRequest request)
        {
            try
            {
                if (request.MappingIds == null || request.MappingIds.Count == 0)
                {
                    return BadRequest(new { error = "No mapping IDs provided" });
                }

                var exportData = await _mappingService.ExportMappingsAsync(request.MappingIds);
                return File(exportData, "application/json", "wiremock-mappings.json");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to export mappings: {ex.Message}" });
            }
        }
    }
}