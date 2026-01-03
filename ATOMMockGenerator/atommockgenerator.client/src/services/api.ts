import axios from 'axios';
import type { JsonConfig, ValidationResult, WiremockMapping, ATOMConfig } from '../types/index.js';
import { validationService } from './validation.js';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const configService = {
  async validateConfig(config: JsonConfig | ATOMConfig): Promise<ValidationResult> {
    console.log('API service - validateConfig called with:', config);
    
    try {
      // Always use server-side validation for consistency
      const response = await api.post<ValidationResult>('/config/validate', config);
      console.log('API service - validation response:', response.data);
      return response.data;
    } catch (error) {
      console.error('API service - validation failed:', error);
      throw error;
    }
  },

  async generateMappings(config: JsonConfig | ATOMConfig): Promise<WiremockMapping[]> {
    const response = await api.post<WiremockMapping[]>('/config/generate-mappings', config);
    return response.data;
  },

  async downloadTemplate(): Promise<Blob> {
    const response = await api.get('/config/template', {
      responseType: 'blob',
    });
    return response.data;
  },

  // Validate ATOM config specifically (client-side only)
  validateATOMConfigClientSide(config: ATOMConfig): ValidationResult {
    return validationService.validateATOMConfig(config);
  },
};

export const mappingService = {
  async getAllMappings(): Promise<WiremockMapping[]> {
    const response = await api.get<WiremockMapping[]>('/mappings');
    return response.data;
  },

  async deleteMapping(id: string): Promise<void> {
    await api.delete(`/mappings/${id}`);
  },

  async updateMapping(id: string, mapping: WiremockMapping): Promise<WiremockMapping> {
    const response = await api.put<WiremockMapping>(`/mappings/${id}`, mapping);
    return response.data;
  },

  async downloadMappings(mappingIds: string[]): Promise<Blob> {
    const response = await api.post('/mappings/download', { mappingIds }, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default api;