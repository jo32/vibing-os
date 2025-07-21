import React from 'react';
import { CustomComponent } from './custom';
import './global.css';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            VibingOS Test App
          </h1>
          <p className="text-gray-600">
            Testing streaming compilation with main.tsx, custom.tsx, and global.css
          </p>
        </header>
        
        <main className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Main Component Features
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li>✅ TypeScript JSX compilation</li>
              <li>✅ Tailwind CSS styling</li>
              <li>✅ Component imports</li>
              <li>✅ CSS file imports</li>
            </ul>
          </div>
          
          <CustomComponent 
            title="Custom Component Test"
            description="This component is imported from custom.tsx"
            count={42}
          />
          
          <div className="test-styles">
            <p>This text should be styled by global.css</p>
          </div>
        </main>
      </div>
    </div>
  );
}