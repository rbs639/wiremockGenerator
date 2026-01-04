import axios from 'axios';
import type { JsonConfig, ValidationResult, WiremockMapping, ATOMConfig } from '../types/index.js';
import { validationService } from './validation.js';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export interface ValidateAndDeployResponse {
  success: boolean;
  message: string;
  validation: ValidationResult;
  deployed?: {
    target: string;
    mappingsCount: number;
    mappings: Array<{
      id: string;
      method: string;
      url: string;
    }>;
  };
}

export interface DeployMappingsRequest {
  targetUrl: string;
  mappings: WiremockMapping[];
  auth?: {
    type: 'none' | 'basic' | 'bearer';
    username?: string;
    password?: string;
    token?: string;
  };
}

export interface ResetWiremockRequest {
  targetUrl: string;
  auth?: {
    type: 'none' | 'basic' | 'bearer';
    username?: string;
    password?: string;
    token?: string;
  };
}

export interface GetMappingsRequest {
  targetUrl: string;
  auth?: {
    type: 'none' | 'basic' | 'bearer';
    username?: string;
    password?: string;
    token?: string;
  };
}

export interface GetMappingsResponse {
  success: boolean;
  mappings: WiremockMapping[];
  count: number;
  target: string;
  message?: string;
  error?: string;
}

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

  async validateAndDeploy(config: JsonConfig | ATOMConfig): Promise<ValidateAndDeployResponse> {
    console.log('API service - validateAndDeploy called with:', config);
    
    try {
      const response = await api.post<ValidateAndDeployResponse>('/config/validate-and-deploy', config);
      console.log('API service - validate and deploy response:', response.data);
      return response.data;
    } catch (error) {
      console.error('API service - validate and deploy failed:', error);
      throw error;
    }
  },

  async generateMappings(config: JsonConfig | ATOMConfig): Promise<WiremockMapping[]> {
    console.log('API service - generateMappings called with:', config);
    
    try {
      const response = await api.post<WiremockMapping[]>('/config/generate-mappings', config);
      console.log('API service - generate mappings response:', response.data);
      return response.data;
    } catch (error) {
      console.error('API service - generate mappings failed:', error);
      throw error;
    }
  },

  async deployMappings(request: DeployMappingsRequest): Promise<ValidateAndDeployResponse> {
    console.log('API service - deployMappings called with:', request);
    
    try {
      const response = await api.post<ValidateAndDeployResponse>('/config/deploy-mappings', request);
      console.log('API service - deploy mappings response:', response.data);
      return response.data;
    } catch (error) {
      console.error('API service - deploy mappings failed:', error);
      throw error;
    }
  },

  async resetWiremock(request: ResetWiremockRequest): Promise<{ success: boolean; message: string }> {
    console.log('API service - resetWiremock called with:', request);
    
    try {
      const response = await api.delete<{ success: boolean; message: string }>('/config/reset-wiremock', {
        data: request
      });
      console.log('API service - reset wiremock response:', response.data);
      return response.data;
    } catch (error) {
      console.error('API service - reset wiremock failed:', error);
      throw error;
    }
  },

  async getWiremockMappings(request: GetMappingsRequest): Promise<GetMappingsResponse> {
    console.log('API service - getWiremockMappings called with:', request);
    
    try {
      const response = await api.post<GetMappingsResponse>('/config/get-wiremock-mappings', request);
      console.log('API service - get wiremock mappings response:', response.data);
      return response.data;
    } catch (error) {
      console.error('API service - get wiremock mappings failed:', error);
      throw error;
    }
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