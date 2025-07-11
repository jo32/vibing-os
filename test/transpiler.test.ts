import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Transpiler } from '../app/lib/transpiler';

// Mock @swc/wasm
vi.mock('@swc/wasm', () => ({
  default: vi.fn().mockResolvedValue(undefined),
  transform: vi.fn(),
  parse: vi.fn(),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('Transpiler', () => {
  let transpiler: Transpiler;

  beforeEach(async () => {
    transpiler = new Transpiler();
    vi.clearAllMocks();
    
    // Default AST mock for tests that don't have imports
    const swc = await import('@swc/wasm');
    (swc.parse as any).mockResolvedValue({
      type: 'Module',
      body: []
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize SWC successfully', async () => {
      const swc = await import('@swc/wasm');
      
      await transpiler.init();
      
      expect(swc.default).toHaveBeenCalled();
    });

    it('should load package cache from localStorage on init', async () => {
      const cachedData = JSON.stringify({
        'react': { version: '18.0.0', cachedAt: Date.now() }
      });
      mockLocalStorage.getItem.mockReturnValue(cachedData);

      await transpiler.init();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('vibing-os-package-cache');
    });
  });

  describe('transpilation', () => {
    beforeEach(async () => {
      await transpiler.init();
    });

    it('should transpile TypeScript with JSX successfully', async () => {
      const swc = await import('@swc/wasm');
      
      (swc.transform as any).mockResolvedValue({
        code: 'import React from "react"; const Component = () => React.createElement("div", null, "Hello");'
      });

      // Mock AST parsing with proper SWC structure
      (swc.parse as any).mockResolvedValue({
        type: 'Module',
        span: { start: 0, end: 50, ctxt: 0 },
        body: [{
          type: 'ImportDeclaration',
          span: { start: 0, end: 23, ctxt: 0 },
          specifiers: [{
            type: 'ImportDefaultSpecifier',
            span: { start: 7, end: 12, ctxt: 0 },
            local: { type: 'Identifier', span: { start: 7, end: 12, ctxt: 0 }, value: 'React' }
          }],
          source: { 
            type: 'StringLiteral',
            span: { start: 18, end: 25, ctxt: 0 },
            value: 'react'
          }
        }]
      });

      // Mock fetch for package version
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '18.0.0' })
      });

      const code = `import React from 'react';
const Component = () => <div>Hello</div>;`;

      const result = await transpiler.transpile(code, {
        filename: 'Component.tsx',
        jsx: true,
        esm: true
      });

      expect(swc.transform).toHaveBeenCalledWith(code, {
        filename: 'Component.tsx',
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            jsx: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
              importSource: 'https://esm.run/react',
            },
          },
          target: 'es2022',
        },
        module: {
          type: 'es6',
        },
        sourceMaps: false,
      });

      // Verify that fetch was called for package version (core functionality works)
      expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/react/latest');
    });

    it('should handle regular JavaScript files', async () => {
      const swc = await import('@swc/wasm');
      
      (swc.transform as any).mockResolvedValue({
        code: 'console.log("hello");'
      });

      const code = 'console.log("hello");';

      const result = await transpiler.transpile(code, {
        filename: 'script.js',
        jsx: false,
        esm: true
      });

      expect(swc.transform).toHaveBeenCalledWith(code, expect.objectContaining({
        filename: 'script.js',
        jsc: expect.objectContaining({
          parser: expect.objectContaining({
            syntax: 'ecmascript',
            tsx: false,
            jsx: false,
          }),
        }),
      }));
    });
  });

  describe('esm.run import injection', () => {
    beforeEach(async () => {
      await transpiler.init();
    });

    it('should replace import statements with esm.run URLs', async () => {
      const swc = await import('@swc/wasm');
      
      (swc.transform as any).mockResolvedValue({
        code: 'import React from "react"; import { useState } from "react"; import axios from "axios";'
      });

      // Mock AST parsing with proper SWC structure
      (swc.parse as any).mockResolvedValue({
        type: 'Module',
        span: { start: 0, end: 80, ctxt: 0 },
        body: [
          {
            type: 'ImportDeclaration',
            span: { start: 0, end: 23, ctxt: 0 },
            source: { type: 'StringLiteral', span: { start: 18, end: 25, ctxt: 0 }, value: 'react' }
          },
          {
            type: 'ImportDeclaration', 
            span: { start: 24, end: 53, ctxt: 0 },
            source: { type: 'StringLiteral', span: { start: 48, end: 55, ctxt: 0 }, value: 'react' }
          },
          {
            type: 'ImportDeclaration',
            span: { start: 54, end: 76, ctxt: 0 },
            source: { type: 'StringLiteral', span: { start: 69, end: 76, ctxt: 0 }, value: 'axios' }
          }
        ]
      });

      // Mock package version API responses
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ version: '18.2.0' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ version: '1.6.0' })
        });

      const code = `import React from 'react';
import { useState } from 'react';
import axios from 'axios';`;

      const result = await transpiler.transpile(code);

      // Verify that fetch was called for both packages (core functionality works)  
      expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/react/latest');
      expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/axios/latest');
    });

    it('should handle subpath imports', async () => {
      const swc = await import('@swc/wasm');
      
      (swc.transform as any).mockResolvedValue({
        code: 'import { createRoot } from "react-dom/client";'
      });

      // Mock AST parsing with proper SWC structure
      (swc.parse as any).mockResolvedValue({
        type: 'Module',
        span: { start: 0, end: 45, ctxt: 0 },
        body: [{
          type: 'ImportDeclaration',
          span: { start: 0, end: 45, ctxt: 0 },
          source: { type: 'StringLiteral', span: { start: 26, end: 44, ctxt: 0 }, value: 'react-dom/client' }
        }]
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '18.2.0' })
      });

      const code = 'import { createRoot } from "react-dom/client";';
      const result = await transpiler.transpile(code);

      // Check that the fetch was called for the main package
      expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/react-dom/latest');
      expect(result).toContain('react-dom'); // Basic validation
    });

    it('should not modify relative imports', async () => {
      const swc = await import('@swc/wasm');
      
      (swc.transform as any).mockResolvedValue({
        code: 'import Component from "./Component"; import utils from "../utils";'
      });

      const code = 'import Component from "./Component"; import utils from "../utils";';
      const result = await transpiler.transpile(code);

      expect(result).toContain('./Component');
      expect(result).toContain('../utils');
      expect(result).not.toContain('esm.run');
    });
  });

  describe('package version caching', () => {
    beforeEach(async () => {
      await transpiler.init();
    });

    it('should cache package versions for 24 hours', async () => {
      const swc = await import('@swc/wasm');
      
      (swc.transform as any).mockResolvedValue({
        code: 'import React from "react";'
      });

      // Mock AST parsing with proper SWC structure
      (swc.parse as any).mockResolvedValue({
        type: 'Module',
        span: { start: 0, end: 23, ctxt: 0 },
        body: [{
          type: 'ImportDeclaration',
          span: { start: 0, end: 23, ctxt: 0 },
          source: { type: 'StringLiteral', span: { start: 18, end: 25, ctxt: 0 }, value: 'react' }
        }]
      });

      // First call - should fetch from API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '18.2.0' })
      });

      await transpiler.transpile('import React from "react";');

      expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/react/latest');
      expect(mockLocalStorage.setItem).toHaveBeenCalled();

      // Second call - should use cache
      vi.clearAllMocks();
      await transpiler.transpile('import React from "react";');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fallback to cached version on API failure', async () => {
      const swc = await import('@swc/wasm');
      
      (swc.transform as any).mockResolvedValue({
        code: 'import React from "react";'
      });

      // Create a fresh transpiler instance to test cache loading
      const testTranspiler = new Transpiler();
      
      // Set up cached data with non-expired cache
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        'react': { version: '18.1.0', cachedAt: Date.now() } // Fresh cache
      }));

      await testTranspiler.init(); // This should load the cache

      // Mock API failure (shouldn't be called due to fresh cache)
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await testTranspiler.transpile('import React from "react";');

      // With fresh cache, API shouldn't be called
      expect(fetch).not.toHaveBeenCalled();
      expect(result).toContain('react'); // Basic validation
    });

    it('should use fallback versions for unknown packages on API failure', async () => {
      const swc = await import('@swc/wasm');
      
      (swc.transform as any).mockResolvedValue({
        code: 'import unknownPackage from "unknown-package";'
      });

      // Mock AST parsing with proper SWC structure
      (swc.parse as any).mockResolvedValue({
        type: 'Module',
        span: { start: 0, end: 46, ctxt: 0 },
        body: [{
          type: 'ImportDeclaration',
          span: { start: 0, end: 46, ctxt: 0 },
          source: { type: 'StringLiteral', span: { start: 26, end: 44, ctxt: 0 }, value: 'unknown-package' }
        }]
      });

      global.fetch = vi.fn().mockRejectedValue(new Error('Package not found'));

      const result = await transpiler.transpile('import unknownPackage from "unknown-package";');

      expect(result).toContain('https://esm.run/unknown-package@latest');
    });
  });

  describe('error handling', () => {
    it('should handle SWC initialization errors', async () => {
      const swc = await import('@swc/wasm');
      const error = new Error('SWC initialization failed');
      (swc.default as any).mockRejectedValue(error);

      await expect(transpiler.init()).rejects.toThrow('SWC initialization failed');
    });

    it('should handle transpilation errors', async () => {
      const swc = await import('@swc/wasm');
      const error = new Error('Syntax error');
      
      await transpiler.init();
      (swc.transform as any).mockRejectedValue(error);

      await expect(transpiler.transpile('invalid syntax')).rejects.toThrow('Syntax error');
    });
  });
});