import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, 
  faTrash, 
  faEdit, 
  faSpinner,
  faServer,
  faInfoCircle,
  faExclamationTriangle,
  faRocket,
  faEye,
  faCode,
  faTimes,
  faRefresh
} from '@fortawesome/free-solid-svg-icons';
import type { WiremockMapping, User } from '../../types';
import { configService, type GetMappingsRequest } from '../../services/api';
import MappingEditor from './MappingEditor';

interface MappingListProps {
  currentUser?: User;
}

const MappingList: React.FC<MappingListProps> = ({ currentUser }) => {
  const [mappings, setMappings] = useState<WiremockMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMapping, setEditingMapping] = useState<WiremockMapping | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Default connection settings - hidden from UI
  const defaultTargetUrl = 'http://localhost:8080';
  const defaultAuth = {
    type: 'basic' as const,
    username: 'admin',
    password: 'admin123'
  };

  const loadMappingsFromWiremock = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const request: GetMappingsRequest = {
        targetUrl: defaultTargetUrl,
        auth: {
          type: 'basic',
          username: defaultAuth.username,
          password: defaultAuth.password
        }
      };

      const response = await configService.getWiremockMappings(request);
      
      if (response.success) {
        setMappings(response.mappings);
        setError(null);
      } else {
        setError(response.message || 'Failed to fetch mappings');
        setMappings([]);
      }
    } catch (err: any) {
      console.error('Failed to load mappings:', err);
      setError(err.response?.data?.message || err.message || 'Failed to connect to WireMock server');
      setMappings([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch mappings when component mounts
  useEffect(() => {
    loadMappingsFromWiremock();
  }, []);

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
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

  const handleEditMapping = (mapping: WiremockMapping) => {
    setEditingMapping(mapping);
    setShowEditor(true);
  };

  const handleSaveMapping = async (mapping: WiremockMapping) => {
    // For now, just close the editor - implementing full edit would require additional API endpoints
    setShowEditor(false);
    setEditingMapping(null);
    // In a full implementation, you would update the mapping via WireMock admin API
    alert('Edit functionality would update the mapping in WireMock. This requires implementing additional API endpoints.');
  };

  const filteredMappings = mappings.filter(mapping => {
    const url = mapping.request.url || mapping.request.urlPattern || '';
    return url.toLowerCase().includes(searchTerm.toLowerCase()) ||
           mapping.request.method.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const canEdit = currentUser?.role === 'Admin' || currentUser?.role === 'Write';

  // Loading state
  if (isLoading && mappings.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-8 text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin h-12 w-12 text-blue-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Mappings</h3>
          <p className="text-gray-600">
            Fetching mappings from WireMock server at {defaultTargetUrl}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header with Refresh Button */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FontAwesomeIcon icon={faServer} className="text-blue-600 mr-2 h-5 w-5" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">WireMock Mappings</h3>
              <p className="text-sm text-gray-600">
                Connected to {defaultTargetUrl} • {mappings.length} mappings found
              </p>
            </div>
          </div>
          <button
            onClick={loadMappingsFromWiremock}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2 h-4 w-4" />
                Refreshing...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faRefresh} className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600 mr-2 h-5 w-5" />
              <span className="font-medium text-red-800">Connection Error</span>
            </div>
            <button
              onClick={loadMappingsFromWiremock}
              className="text-sm text-red-600 hover:text-red-500 font-medium"
            >
              Try Again
            </button>
          </div>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <p className="text-xs text-red-600 mt-1">
            Make sure WireMock is running on {defaultTargetUrl}
          </p>
        </div>
      )}

      {/* Search */}
      {mappings.length > 0 && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
          <div className="flex items-center">
            <FontAwesomeIcon icon={faSearch} className="text-gray-400 mr-3 h-5 w-5" />
            <input
              type="text"
              placeholder="Search mappings by URL or method..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mappings Table */}
      {mappings.length > 0 && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faServer} className="text-gray-600 mr-2 h-5 w-5" />
                <span className="font-semibold text-gray-900">
                  WireMock Mappings ({filteredMappings.length})
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {searchTerm ? `Filtered from ${mappings.length} total` : `${mappings.length} total mappings`}
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 font-semibold text-gray-700 text-sm">Method</th>
                  <th className="text-left py-3 px-6 font-semibold text-gray-700 text-sm">URL</th>
                  <th className="text-left py-3 px-6 font-semibold text-gray-700 text-sm">Request Data</th>
                  <th className="text-left py-3 px-6 font-semibold text-gray-700 text-sm">Response Data</th>
                  <th className="text-left py-3 px-6 font-semibold text-gray-700 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMappings.map((mapping) => (
                  <React.Fragment key={mapping.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="py-3 px-6 text-sm">
                        <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                          {mapping.request.method}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-sm">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {mapping.request.url || mapping.request.urlPattern || 'N/A'}
                        </code>
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-600 max-w-xs">
                        <div className="truncate">{formatRequestData(mapping.request)}</div>
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-600 max-w-xs">
                        <div className="truncate">{formatResponseData(mapping.response)}</div>
                      </td>
                      <td className="py-3 px-6 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleRowExpansion(mapping.id)}
                            className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          >
                            <FontAwesomeIcon icon={expandedRows.has(mapping.id) ? faTimes : faEye} className="mr-1 h-3 w-3" />
                            {expandedRows.has(mapping.id) ? 'Hide' : 'View'}
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleEditMapping(mapping)}
                              className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                              <FontAwesomeIcon icon={faEdit} className="mr-1 h-3 w-3" />
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(mapping.id) && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 px-6 py-4">
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

          {filteredMappings.length === 0 && mappings.length > 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No mappings found matching "{searchTerm}".</p>
              <button
                onClick={() => setSearchTerm('')}
                className="text-blue-600 hover:text-blue-500 text-sm mt-2"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State - No Mappings */}
      {!error && !isLoading && mappings.length === 0 && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-8 text-center">
          <FontAwesomeIcon icon={faInfoCircle} className="h-12 w-12 text-blue-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Mappings Found</h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            No WireMock mappings were found on the server at {defaultTargetUrl}.
            Deploy some configurations from the Upload tab to see them here.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-2xl mx-auto">
            <h4 className="font-medium text-blue-900 mb-2">
              <FontAwesomeIcon icon={faRocket} className="mr-2" />
              Get Started:
            </h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to the Upload Configuration tab</li>
              <li>Upload an ATOM config file</li>
              <li>Deploy the mappings to WireMock</li>
              <li>Return here to view and manage your mappings</li>
            </ol>
          </div>
        </div>
      )}

      {/* Mapping Editor Modal */}
      {showEditor && editingMapping && (
        <MappingEditor
          mapping={editingMapping}
          onSave={handleSaveMapping}
          onCancel={() => {
            setShowEditor(false);
            setEditingMapping(null);
          }}
        />
      )}
    </div>
  );
};

export default MappingList;