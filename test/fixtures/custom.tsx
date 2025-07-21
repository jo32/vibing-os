import React, { useState } from 'react';

interface CustomComponentProps {
  title: string;
  description: string;
  count: number;
}

export function CustomComponent({ title, description, count }: CustomComponentProps) {
  const [clickCount, setClickCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    setClickCount(prev => prev + 1);
  };

  const toggleExpanded = () => {
    setIsExpanded(prev => !prev);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-l-4 border-blue-500">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-800">
          {title}
        </h3>
        <button
          onClick={toggleExpanded}
          className="text-blue-600 hover:text-blue-800 transition-colors"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>
      
      <p className="text-gray-600 mb-4">
        {description}
      </p>
      
      {isExpanded && (
        <div className="space-y-4 border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded p-3">
              <span className="font-medium text-gray-700">Initial Count:</span>
              <span className="ml-2 text-blue-600 font-mono">{count}</span>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <span className="font-medium text-gray-700">Click Count:</span>
              <span className="ml-2 text-green-600 font-mono">{clickCount}</span>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleClick}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Click me! ({clickCount})
            </button>
            
            <button
              onClick={() => setClickCount(0)}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Reset
            </button>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Test Features:</strong>
            </p>
            <ul className="text-xs text-yellow-700 mt-1 space-y-1">
              <li>✅ TypeScript interfaces and props</li>
              <li>✅ React hooks (useState)</li>
              <li>✅ Event handlers</li>
              <li>✅ Conditional rendering</li>
              <li>✅ Tailwind CSS classes</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export const UtilityFunction = (text: string): string => {
  return text.toUpperCase().replace(/\s+/g, '_');
};

export const CONSTANTS = {
  VERSION: '1.0.0',
  BUILD_TIME: new Date().toISOString(),
  FEATURES: ['tsx', 'css', 'imports'] as const
} as const;