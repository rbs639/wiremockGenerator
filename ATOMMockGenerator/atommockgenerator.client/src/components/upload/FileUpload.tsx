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
  faServer
} from '@fortawesome/free-solid-svg-icons';
import type { JsonConfig, ValidationResult, ATOMConfig } from '../../types/index.js';
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
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<ValidateAndDeployResponse | null>(null);
  const [showManualDeploy, setShowManualDeploy] = useState(false);
  const [manualTargetUrl, setManualTargetUrl] = useState('http://localhost:8080');
  const [manualAuth, setManualAuth] = useState({
    type: 'basic' as const,
    username: 'admin',
    password: 'admin123'
  });

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
      setDeploymentResult(null); // Clear previous deployment results
      validateFile(selectedFile);
    } else {
      alert('Please select a valid JSON file');
    }
  };

  const validateFile = async (file: File) => {
    setIsValidating(true);
    setValidationResult(null);
    setUploadedConfig(null);
    
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
    } catch (error: any) {
      console.error('Failed to validate and deploy:', error);
      
      // Handle case where config doesn't have target info
      if (error.response?.data?.message?.includes('Target baseUrl is required')) {
        setShowManualDeploy(true);
        setDeploymentResult({
          success: false,
          message: 'Configuration lacks target information. Please provide Wiremock server details below.',
          validation: validationResult
        });
      } else {
        setDeploymentResult({
          success: false,
          message: error.response?.data?.message || error.message || 'Deployment failed',
          validation: validationResult
        });
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const deployWithManualConfig = async () => {
    if (!uploadedConfig || !validationResult?.isValid) return;

    setIsDeploying(true);
    
    try {
      // First generate mappings
      const mappings = await configService.generateMappings(uploadedConfig);
      
      // Then deploy them with manual configuration
      const deployRequest: DeployMappingsRequest = {
        targetUrl: manualTargetUrl,
        mappings: mappings,
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
    } catch (error: any) {
      console.error('Failed to deploy with manual config:', error);
      setDeploymentResult({
        success: false,
        message: error.response?.data?.message || error.message || 'Manual deployment failed',
        validation: validationResult
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const generateMappings = async () => {
    if (!file || !validationResult?.isValid || !uploadedConfig) return;

    setIsGenerating(true);
    try {
      const mappings = await configService.generateMappings(uploadedConfig);
      
      // Success notification - in a real app, you might show a toast notification
      alert(`Successfully generated ${mappings.length} wiremock mappings!`);
    } catch (error) {
      console.error('Failed to generate mappings:', error);
      alert('Failed to generate mappings');
    } finally {
      setIsGenerating(false);
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
    <div className="space-y-6">
      {/* Template Download */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Get Started</h3>
            <p className="text-sm text-gray-500">
              Download our template JSON file to understand the expected ATOM config format
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="btn-secondary"
          >
            <FontAwesomeIcon icon={faDownload} className="mr-2" />
            Download Template
          </button>
        </div>
      </div>

      {/* File Upload */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Configuration</h3>
        
        {!file ? (
          <div
            className={`file-drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <FontAwesomeIcon icon={faCloudUploadAlt} className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg text-gray-600 mb-2">
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
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
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
                className="text-gray-400 hover:text-red-500"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>

            {/* Config Summary */}
            {uploadedConfig && validationResult?.isValid && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <div className="flex items-center mb-2">
                  <FontAwesomeIcon icon={faInfoCircle} className="text-blue-600 mr-2" />
                  <span className="font-medium text-blue-800">Configuration Summary</span>
                </div>
                {summary && (
                  <div className="text-sm text-blue-700 space-y-1">
                    <div>Version: {summary.version}</div>
                    <div>Mock Count: {summary.mockCount}</div>
                    {summary.hasTarget && (
                      <div className="flex items-center">
                        <FontAwesomeIcon icon={faServer} className="mr-1" />
                        Target: {summary.targetUrl}
                      </div>
                    )}
                    {summary.hasAuth && <div>? Authentication configured</div>}
                    {summary.hasDefaults && <div>? Default settings configured</div>}
                    {!summary.hasTarget && (
                      <div className="text-yellow-700 mt-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" />
                        No target server configured - manual deployment required
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Validation Status */}
            {isValidating && (
              <div className="flex items-center text-blue-600 mb-4">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                <span>Validating configuration...</span>
              </div>
            )}

            {validationResult && (
              <div className="mb-4">
                <div className={`flex items-center mb-3 ${validationResult.isValid ? 'text-green-600' : 'text-red-600'}`}>
                  <FontAwesomeIcon 
                    icon={validationResult.isValid ? faCheck : faTimes} 
                    className="mr-2" 
                  />
                  <span className="font-medium">
                    {validationResult.isValid ? 'Configuration is valid' : 'Configuration has errors'}
                  </span>
                  {validationResult.warnings.length > 0 && (
                    <span className="ml-2 text-yellow-600">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" />
                      {validationResult.warnings.length} warning(s)
                    </span>
                  )}
                </div>

                {validationResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                    <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {validationResult.errors.map((error, index) => (
                        <li key={index} className="flex items-start">
                          <span className="font-mono text-xs bg-red-100 px-1 py-0.5 rounded mr-2 mt-0.5">
                            {error.path || 'root'}
                          </span>
                          <span>{error.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <h4 className="font-medium text-yellow-800 mb-2">Warnings:</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {validationResult.warnings.map((warning, index) => (
                        <li key={index} className="flex items-start">
                          <span className="font-mono text-xs bg-yellow-100 px-1 py-0.5 rounded mr-2 mt-0.5">
                            {warning.path || 'root'}
                          </span>
                          <span>{warning.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Deployment Result */}
            {deploymentResult && (
              <div className={`mb-4 p-3 rounded border ${deploymentResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className={`flex items-center mb-2 ${deploymentResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  <FontAwesomeIcon 
                    icon={deploymentResult.success ? faCheck : faTimes} 
                    className="mr-2" 
                  />
                  <span className="font-medium">
                    {deploymentResult.success ? 'Deployment Successful' : 'Deployment Failed'}
                  </span>
                </div>
                <p className={`text-sm ${deploymentResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {deploymentResult.message}
                </p>
                {deploymentResult.deployed && (
                  <div className="mt-2 text-sm text-green-700">
                    <div>Target: {deploymentResult.deployed.target}</div>
                    <div>Mappings Created: {deploymentResult.deployed.mappingsCount}</div>
                  </div>
                )}
              </div>
            )}

            {/* Manual Deploy Configuration */}
            {showManualDeploy && (
              <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3">
                  <FontAwesomeIcon icon={faCog} className="mr-2" />
                  Manual Deployment Configuration
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wiremock Server URL
                    </label>
                    <input
                      type="url"
                      value={manualTargetUrl}
                      onChange={(e) => setManualTargetUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="http://localhost:8080"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Authentication
                    </label>
                    <select
                      value={manualAuth.type}
                      onChange={(e) => setManualAuth({ ...manualAuth, type: e.target.value as 'basic' | 'none' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
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
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="password"
                          value={manualAuth.password}
                          onChange={(e) => setManualAuth({ ...manualAuth, password: e.target.value })}
                          placeholder="Password"
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {validationResult?.isValid && (
              <div className="space-y-2">
                {canAutoDeploy ? (
                  <button
                    onClick={validateAndDeploy}
                    disabled={isDeploying}
                    className="btn-primary w-full"
                  >
                    {isDeploying ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                        Deploying to Wiremock...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faRocket} className="mr-2" />
                        Deploy to Wiremock ({summary?.targetUrl})
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowManualDeploy(!showManualDeploy)}
                      className="btn-primary w-full"
                    >
                      <FontAwesomeIcon icon={faCog} className="mr-2" />
                      Configure Manual Deployment
                    </button>
                    {showManualDeploy && (
                      <button
                        onClick={deployWithManualConfig}
                        disabled={isDeploying}
                        className="btn-secondary w-full"
                      >
                        {isDeploying ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                            Deploying to Wiremock...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faRocket} className="mr-2" />
                            Deploy to {manualTargetUrl}
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
                
                <button
                  onClick={generateMappings}
                  disabled={isGenerating}
                  className="btn-secondary w-full"
                >
                  {isGenerating ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                      Generating Mappings...
                    </>
                  ) : (
                    'Generate Mappings Only'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;