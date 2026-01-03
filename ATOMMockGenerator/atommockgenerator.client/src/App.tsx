import React, { useState } from 'react';
import Layout from './components/Layout.js';
import FileUpload from './components/upload/FileUpload.js';
import MappingList from './components/manage/MappingList.js';
import type { JsonConfig, ATOMConfig, User } from './types/index.js';
import './App.css';

// Mock current user - in a real app, this would come from authentication
const mockUser: User = {
  id: '1',
  username: 'admin',
  role: 'Admin'
};

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');
  const [uploadedConfig, setUploadedConfig] = useState<JsonConfig | ATOMConfig | null>(null);

  const handleConfigUploaded = (config: JsonConfig | ATOMConfig) => {
    console.log('Config uploaded:', config);
    setUploadedConfig(config);
    // Auto-switch to manage tab after successful upload
    setActiveTab('manage');
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'upload' ? (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Upload Configuration</h2>
            <p className="mt-2 text-gray-600">
              Upload your ATOM configuration file to generate Wiremock mappings and responses.
              Supports both ATOM config format and legacy Wiremock configurations.
            </p>
          </div>
          <FileUpload onConfigUploaded={handleConfigUploaded} />
        </div>
      ) : (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Manage Wiremock Mappings</h2>
            <p className="mt-2 text-gray-600">
              View, edit, delete, and download your generated Wiremock mappings.
            </p>
            {uploadedConfig && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  ? Configuration loaded successfully - {'mocks' in uploadedConfig ? `${uploadedConfig.mocks.length} mocks` : `${uploadedConfig.mappings?.length || 0} mappings`} ready for processing
                </p>
              </div>
            )}
          </div>
          <MappingList currentUser={mockUser} />
        </div>
      )}
    </Layout>
  );
}

export default App;
