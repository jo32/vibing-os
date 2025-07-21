'use client';

import React, { useEffect, useState } from 'react';
import { Preview } from '../components/preview';
import { vfs } from '../lib/filesystem';

export default function TestPlayground() {
  const [fixturesLoaded, setFixturesLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadFixtures = async () => {
    setIsLoading(true);
    try {
      // Load fixture files into virtual filesystem
      const mainTsx = await fetch('/test/fixtures/main.tsx').then(r => r.text());
      const customTsx = await fetch('/test/fixtures/custom.tsx').then(r => r.text());
      const globalCss = await fetch('/test/fixtures/global.css').then(r => r.text());

      await vfs.writeFile('/main.tsx', mainTsx);
      await vfs.writeFile('/custom.tsx', customTsx);
      await vfs.writeFile('/global.css', globalCss);

      setFixturesLoaded(true);
      console.log('Test fixtures loaded successfully');
    } catch (error) {
      console.error('Failed to load fixtures:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-load fixtures on component mount
    loadFixtures();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          VibingOS Streaming Compiler Test Playground
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
            <div className="h-96 border border-gray-300 rounded">
              <Preview 
                entryPoint="/main.tsx"
                includeTailwind={true}
                includeRuntime={true}
                className="w-full h-full rounded"
              />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Compiler Status</h2>
            <div id="compiler-status" className="space-y-4">
              <div className="text-sm text-gray-600">
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Loading fixtures...
                  </div>
                ) : fixturesLoaded ? (
                  <div className="text-green-600">✅ Fixtures loaded successfully</div>
                ) : (
                  <div className="text-red-600">❌ Fixtures not loaded</div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          <div className="flex space-x-4">
            <button 
              onClick={loadFixtures}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Reload Test Fixtures'}
            </button>
            <button 
              onClick={() => (window as any).refreshPreview?.()}
              disabled={!fixturesLoaded}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Compile & Preview
            </button>
            <button 
              onClick={() => {
                setFixturesLoaded(false);
                // Clear virtual filesystem would be here
                console.log('Cache cleared');
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Clear Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}