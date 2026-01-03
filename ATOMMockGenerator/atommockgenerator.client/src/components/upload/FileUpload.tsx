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
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import type { JsonConfig, ValidationResult, ATOMConfig } from '../../types/index.js';
import { configService } from '../../services/api.js';
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

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = async () => {
    try {
      // Create a sample ATOM config based on the schema
      const sampleConfig = {
        version: "1.0",
        target: {
          baseUrl: "http://wiremock.local:8080",
          auth: { 
            type: "basic" as const, 
            username: "svc", 
            password: "*****" 
          }
        },
        defaults: {
          priority: 5,
          headers: { "Content-Type": "application/json" },
          templating: { enabled: false }
        },
        mocks: [
          {
            name: "Get user by id",
            priority: 1,
            request: {
              method: "GET" as const,
              urlPath: "/users/{userId}",
              pathTemplate: "/users/{userId}",
              queryParameters: {
                verbose: { equalTo: "true" }
              },
              headers: {
                Accept: { contains: "application/json" }
              }
            },
            response: {
              status: 200,
              headers: { "Content-Type": "application/json" },
              body: {
                type: "inline" as const,
                value: "{ \"id\": \"{{request.pathSegments.[1]}}\", \"name\": \"John\" }",
                templating: true
              },
              fixedDelayMilliseconds: 100
            },
            scenario: {
              name: "User lifecycle",
              requiredState: "Started",
              newState: "Fetched"
            },
            metadata: {
              owner: "team-a",
              jira: "ABC-123"
            }
          }
        ]
      };

      const blob = new Blob([JSON.stringify(sampleConfig, null, 2)], { type: 'application/json' });
      downloadFile(blob, 'atom-config-template.json');
    } catch (error) {
      console.error('Failed to download template:', error);
      alert('Failed to download template');
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
        hasTarget: !!atomConfig.target,
        hasDefaults: !!atomConfig.defaults
      };
    } else {
      const legacyConfig = uploadedConfig as JsonConfig;
      return {
        version: legacyConfig.version,
        mockCount: legacyConfig.mappings?.length || 0,
        hasTarget: !!legacyConfig.baseUrl,
        hasDefaults: false
      };
    }
  };

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
                {(() => {
                  const summary = getConfigSummary();
                  return summary ? (
                    <div className="text-sm text-blue-700 space-y-1">
                      <div>Version: {summary.version}</div>
                      <div>Mock Count: {summary.mockCount}</div>
                      {summary.hasTarget && <div>? Target configuration present</div>}
                      {summary.hasDefaults && <div>? Default settings configured</div>}
                    </div>
                  ) : null;
                })()}
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

            {/* Generate Button */}
            {validationResult?.isValid && (
              <button
                onClick={generateMappings}
                disabled={isGenerating}
                className="btn-primary w-full"
              >
                {isGenerating ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                    Generating Mappings...
                  </>
                ) : (
                  'Generate Wiremock Mappings'
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;