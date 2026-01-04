import React, { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCloudUploadAlt, 
  faDownload, 
  faCheck, 
  faTimes, 
  faSpinner,
  faFile,
  faTrash,
  faExclamationTriangle,
  faInfoCircle,
  faRocket,
  faCog,
  faServer,
  faTable,
  faEye,
  faCode
} from '@fortawesome/free-solid-svg-icons';
import type { JsonConfig, ValidationResult, ATOMConfig, WiremockMapping } from '../../types/index.js';
import { configService, type ValidateAndDeployResponse, type DeployMappingsRequest } from '../../services/api.js';
import { downloadFile } from '../../utils/helpers.js';

interface FileUploadProps {
  onConfigUploaded: (config: JsonConfig | ATOMConfig) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onConfigUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedConfig, setUploadedConfig] = useState<ATOMConfig | JsonConfig | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [generatedMappings, setGeneratedMappings] = useState<WiremockMapping[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<ValidateAndDeployResponse | null>(null);
  const [showManualDeploy, setShowManualDeploy] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [manualTargetUrl, setManualTargetUrl] = useState('http://localhost:8080');
  const [manualAuth, setManualAuth] = useState<{
    type: 'basic' | 'none';
    username: string;
    password: string;
  }>({
    type: 'basic',
    username: 'admin',
    password: 'admin123'
  });

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
      setDeploymentResult(null);
      setGeneratedMappings([]);
      validateFile(selectedFile);
    } else {
      alert('Please select a valid JSON file');
    }
  };

  const validateFile = async (file: File) => {
    setIsValidating(true);
    setValidationResult(null);
    setUploadedConfig(null);
    setGeneratedMappings([]);
    
    try {
      const content = await file.text();
      console.log('File content:', content);
      
      let config: ATOMConfig | JsonConfig;
      
      try {
        config = JSON.parse(content) as ATOMConfig | JsonConfig;
        console.log('Parsed config:', config);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        setValidationResult({
          isValid: false,
          errors: [{ path: 'root', message: 'Invalid JSON format', severity: 'error' }],
          warnings: []
        });
        setIsValidating(false);
        return;
      }

      console.log('Sending config for validation...');
      
      try {
        const result = await configService.validateConfig(config);
        console.log('Validation result:', result);
        
        setValidationResult(result);
        setUploadedConfig(config);
        
        if (result.isValid) {
          onConfigUploaded(config);
          // Automatically generate mappings after successful validation
          await generateMappingsDirectly(config);
        }
      } catch (apiError) {
        console.error('API validation error:', apiError);
        setValidationResult({
          isValid: false,
          errors: [{ path: 'root', message: `Server validation failed: ${apiError}`, severity: 'error' }],
          warnings: []
        });
      }
    } catch (error) {
      console.error('File processing error:', error);
      setValidationResult({
        isValid: false,
        errors: [{ path: 'root', message: `File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`, severity: 'error' }],
        warnings: []
      });
    } finally {
      setIsValidating(false);
    }
  };

  const generateMappingsDirectly = async (config: ATOMConfig | JsonConfig) => {
    setIsGenerating(true);
    try {
      console.log('Auto-generating mappings for config:', config);
      const mappings = await configService.generateMappings(config);
      console.log('Generated mappings successfully:', mappings);
      setGeneratedMappings(mappings);
      
      if (mappings.length === 0) {
        console.warn('No mappings were generated from the config');
      }
    } catch (error) {
      console.error('Failed to generate mappings:', error);
      setGeneratedMappings([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const formatRequestData = (request: WiremockMapping['request']) => {
    const data = [];
    if (request.headers && Object.keys(request.headers).length > 0) {
      data.push(`Headers: ${Object.keys(request.headers).length} items`);
    }
    if (request.bodyPatterns && request.bodyPatterns.length > 0) {
      data.push(`Body patterns: ${request.bodyPatterns.length}`);
    }
    return data.length > 0 ? data.join(', ') : 'None';
  };

  const formatResponseData = (response: WiremockMapping['response']) => {
    const data = [];
    data.push(`Status: ${response.status}`);
    if (response.headers && Object.keys(response.headers).length > 0) {
      data.push(`Headers: ${Object.keys(response.headers).length}`);
    }
    if (response.body) {
      data.push(`Body: ${response.body.length > 50 ? `${response.body.substring(0, 47)}...` : response.body}`);
    }
    return data.join(', ');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0] as File);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const clearFile = () => {
    setFile(null);
    setUploadedConfig(null);
    setValidationResult(null);
    setDeploymentResult(null);
    setGeneratedMappings([]);
    setExpandedRows(new Set());
    setShowManualDeploy(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = async () => {
    try {
      const blob = await configService.downloadTemplate();
      downloadFile(blob, 'atom-config-template.json');
    } catch (error) {
      console.error('Failed to download template:', error);
      alert('Failed to download template');
    }
  };

  const validateAndDeploy = async () => {
    if (!uploadedConfig || !validationResult?.isValid) return;

    setIsDeploying(true);
    setDeploymentResult(null);
    
    try {
      const result = await configService.validateAndDeploy(uploadedConfig);
      console.log('Deployment result:', result);
      setDeploymentResult(result);
      
      if (result.success) {
        alert(`Successfully deployed ${result.deployed?.mappingsCount || 0} mappings to ${result.deployed?.target}`);
      }
    } catch (error: unknown) {
      console.error('Failed to validate and deploy:', error);
      
      interface ErrorResponse {
        response?: {
          data?: {
            message?: string;
          };
        };
        message?: string;
      }
      
      const errorResponse = error as ErrorResponse;
      if (errorResponse.response?.data?.message?.includes('Target baseUrl is required')) {
        setShowManualDeploy(true);
        setDeploymentResult({
          success: false,
          message: 'Configuration lacks target information. Please provide Wiremock server details below.',
          validation: validationResult || { isValid: false, errors: [], warnings: [] }
        });
      } else {
        setDeploymentResult({
          success: false,
          message: errorResponse.response?.data?.message || errorResponse.message || 'Deployment failed',
          validation: validationResult || { isValid: false, errors: [], warnings: [] }
        });
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const deployWithManualConfig = async () => {
    if (!generatedMappings.length) return;

    setIsDeploying(true);
    
    try {
      const deployRequest: DeployMappingsRequest = {
        targetUrl: manualTargetUrl,
        mappings: generatedMappings,
        auth: manualAuth.type === 'basic' ? {
          type: 'basic',
          username: manualAuth.username,
          password: manualAuth.password
        } : undefined
      };
      
      const result = await configService.deployMappings(deployRequest);
      console.log('Manual deployment result:', result);
      setDeploymentResult(result);
      
      if (result.success) {
        alert(`Successfully deployed ${result.deployed?.mappingsCount || 0} mappings to ${manualTargetUrl}`);
        setShowManualDeploy(false);
      }
    } catch (error: unknown) {
      console.error('Failed to deploy with manual config:', error);
      
      interface ErrorResponse {
        response?: {
          data?: {
            message?: string;
          };
        };
        message?: string;
      }
      
      const errorResponse = error as ErrorResponse;
      setDeploymentResult({
        success: false,
        message: errorResponse.response?.data?.message || errorResponse.message || 'Manual deployment failed',
        validation: validationResult || { isValid: false, errors: [], warnings: [] }
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const getConfigType = () => {
    if (!uploadedConfig) return '';
    return 'mocks' in uploadedConfig ? 'ATOM Config' : 'Legacy Config';
  };

  const getConfigSummary = () => {
    if (!uploadedConfig) return null;
    
    if ('mocks' in uploadedConfig) {
      const atomConfig = uploadedConfig as ATOMConfig;
      return {
        version: atomConfig.version,
        mockCount: atomConfig.mocks?.length || 0,
        hasTarget: !!atomConfig.target?.baseUrl,
        hasAuth: !!atomConfig.target?.auth,
        targetUrl: atomConfig.target?.baseUrl,
        hasDefaults: !!atomConfig.defaults
      };
    } else {
      const legacyConfig = uploadedConfig as JsonConfig;
      return {
        version: legacyConfig.version,
        mockCount: legacyConfig.mappings?.length || 0,
        hasTarget: !!legacyConfig.baseUrl,
        hasAuth: false,
        targetUrl: legacyConfig.baseUrl,
        hasDefaults: false
      };
    }
  };

  const summary = getConfigSummary();
  const canAutoDeploy = summary?.hasTarget;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Template Download */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Get Started</h3>
            <p className="text-sm text-gray-600 mt-1">
              Download our template JSON file to understand the expected ATOM config format
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <FontAwesomeIcon icon={faDownload} className="mr-2 h-4 w-4" />
            Download Template
          </button>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Upload Configuration</h3>
          <p className="text-sm text-gray-600 mt-1">Upload your JSON config file to generate and deploy Wiremock mappings</p>
        </div>
        
        <div className="p-6">
          {!file ? (
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <FontAwesomeIcon icon={faCloudUploadAlt} className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop your JSON config file here or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Supports ATOM config format and legacy WireMock configs
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files[0] as File)}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Info */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faFile} className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB • {getConfigType()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearFile}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors"
                >
                  <FontAwesomeIcon icon={faTrash} className="h-5 w-5" />
                </button>
              </div>

              {/* Validation Status */}
              {isValidating && (
                <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-3 h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Validating configuration...</span>
                </div>
              )}

              {/* Generating Mappings Status */}
              {isGenerating && (
                <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-3 h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Generating mappings...</span>
                </div>
              )}

              {/* Config Summary */}
              {uploadedConfig && validationResult?.isValid && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-green-600 mr-2 h-5 w-5" />
                    <span className="font-semibold text-green-800">Configuration Summary</span>
                  </div>
                  {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-green-700 font-medium">Version:</span>
                        <p className="text-green-600">{summary.version}</p>
                      </div>
                      <div>
                        <span className="text-green-700 font-medium">Mock Count:</span>
                        <p className="text-green-600">{summary.mockCount}</p>
                      </div>
                      <div>
                        <span className="text-green-700 font-medium">Generated:</span>
                        <p className="text-green-600">{generatedMappings.length} mappings</p>
                      </div>
                      <div>
                        <span className="text-green-700 font-medium">Target:</span>
                        <p className="text-green-600">{summary.targetUrl || 'Manual config needed'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Validation Errors/Warnings */}
              {validationResult && !validationResult.isValid && (
                <div className="space-y-3">
                  <div className="flex items-center text-red-600">
                    <FontAwesomeIcon icon={faTimes} className="mr-2 h-5 w-5" />
                    <span className="font-semibold">Configuration has errors</span>
                  </div>

                  {validationResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-semibold text-red-800 mb-2">Errors:</h4>
                      <ul className="space-y-1">
                        {validationResult.errors.map((error, index) => (
                          <li key={index} className="flex items-start">
                            <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded mr-2 mt-0.5 font-mono">
                              {error.path || 'root'}
                            </span>
                            <span className="text-sm text-red-700">{error.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-800 mb-2">Warnings:</h4>
                      <ul className="space-y-1">
                        {validationResult.warnings.map((warning, index) => (
                          <li key={index} className="flex items-start">
                            <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mr-2 mt-0.5 font-mono">
                              {warning.path || 'root'}
                            </span>
                            <span className="text-sm text-yellow-700">{warning.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Generated Mappings Table */}
              {generatedMappings.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faTable} className="text-gray-600 mr-2 h-5 w-5" />
                      <span className="font-semibold text-gray-900">Generated Mappings ({generatedMappings.length})</span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">URL</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Method</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Request Data</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Response Data</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {generatedMappings.map((mapping, index) => (
                          <React.Fragment key={index}>
                            <tr className="hover:bg-gray-50">
                              <td className="py-3 px-4 text-sm">
                                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                  {mapping.request.url || mapping.request.urlPattern || 'N/A'}
                                </code>
                              </td>
                              <td className="py-3 px-4 text-sm">
                                <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                                  {mapping.request.method}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600 max-w-xs">
                                <div className="truncate">{formatRequestData(mapping.request)}</div>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600 max-w-xs">
                                <div className="truncate">{formatResponseData(mapping.response)}</div>
                              </td>
                              <td className="py-3 px-4 text-sm">
                                <button
                                  onClick={() => toggleRowExpansion(index)}
                                  className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                >
                                  <FontAwesomeIcon icon={expandedRows.has(index) ? faTimes : faEye} className="mr-1 h-3 w-3" />
                                  {expandedRows.has(index) ? 'Hide' : 'View'}
                                </button>
                              </td>
                            </tr>
                            {expandedRows.has(index) && (
                              <tr>
                                <td colSpan={5} className="bg-gray-50 px-4 py-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    <div>
                                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                                        <FontAwesomeIcon icon={faCode} className="mr-1" />
                                        Request Details
                                      </h4>
                                      <pre className="bg-white border rounded p-3 text-xs overflow-auto max-h-40">
                                        {JSON.stringify(mapping.request, null, 2)}
                                      </pre>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                                        <FontAwesomeIcon icon={faCode} className="mr-1" />
                                        Response Details
                                      </h4>
                                      <pre className="bg-white border rounded p-3 text-xs overflow-auto max-h-40">
                                        {JSON.stringify(mapping.response, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Deployment Result */}
              {deploymentResult && (
                <div className={`rounded-lg p-4 border ${
                  deploymentResult.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className={`flex items-center mb-2 ${
                    deploymentResult.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <FontAwesomeIcon 
                      icon={deploymentResult.success ? faCheck : faTimes} 
                      className="mr-2 h-5 w-5" 
                    />
                    <span className="font-semibold">
                      {deploymentResult.success ? 'Deployment Successful' : 'Deployment Failed'}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    deploymentResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {deploymentResult.message}
                  </p>
                  {deploymentResult.deployed && (
                    <div className="mt-3 text-sm text-green-700 grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">Target:</span> {deploymentResult.deployed.target}
                      </div>
                      <div>
                        <span className="font-medium">Mappings:</span> {deploymentResult.deployed.mappingsCount}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Deploy Configuration */}
              {showManualDeploy && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <FontAwesomeIcon icon={faCog} className="mr-2 h-5 w-5" />
                    Manual Deployment Configuration
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Wiremock Server URL
                      </label>
                      <input
                        type="url"
                        value={manualTargetUrl}
                        onChange={(e) => setManualTargetUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="http://localhost:8080"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Authentication
                      </label>
                      <select
                        value={manualAuth.type}
                        onChange={(e) => setManualAuth({ 
                          ...manualAuth, 
                          type: e.target.value as 'basic' | 'none' 
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                      >
                        <option value="none">No Authentication</option>
                        <option value="basic">Basic Authentication</option>
                      </select>
                      {manualAuth.type === 'basic' && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={manualAuth.username}
                            onChange={(e) => setManualAuth({ ...manualAuth, username: e.target.value })}
                            placeholder="Username"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            type="password"
                            value={manualAuth.password}
                            onChange={(e) => setManualAuth({ ...manualAuth, password: e.target.value })}
                            placeholder="Password"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {validationResult?.isValid && generatedMappings.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  {canAutoDeploy ? (
                    <button
                      onClick={validateAndDeploy}
                      disabled={isDeploying}
                      className="inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isDeploying ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2 h-4 w-4" />
                          Deploying...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faRocket} className="mr-2 h-4 w-4" />
                          Deploy {generatedMappings.length} Mappings
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowManualDeploy(!showManualDeploy)}
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                      >
                        <FontAwesomeIcon icon={faCog} className="mr-2 h-4 w-4" />
                        Configure Deployment
                      </button>
                      {showManualDeploy && (
                        <button
                          onClick={deployWithManualConfig}
                          disabled={isDeploying}
                          className="inline-flex items-center justify-center px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isDeploying ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2 h-4 w-4" />
                              Deploying...
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faRocket} className="mr-2 h-4 w-4" />
                              Deploy to {new URL(manualTargetUrl).host}
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;