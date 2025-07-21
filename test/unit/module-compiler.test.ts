import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { ModuleCompiler } from '../../app/lib/module-compiler';

// Mock dependencies
vi.mock('../../app/lib/transpiler', () => ({
  transpiler: {
    transpile: vi.fn().mockResolvedValue('// transpiled code'),
    parseCode: vi.fn().mockResolvedValue({
      type: 'Module',
      body: []
    })
  }
}));

vi.mock('../../app/lib/filesystem', () => ({
  vfs: {
    readFile: vi.fn(),
    exists: vi.fn()
  }
}));

vi.mock('../../app/lib/module-registry', () => ({
  moduleRegistry: {
    isExternal: vi.fn().mockReturnValue(false)
  }
}));

vi.mock('@swc/wasm-web', () => ({
  parse: vi.fn().mockResolvedValue({
    type: 'Module',
    body: []
  })
}));

// Helper function to create proper AST nodes
function createImportNode(source: string, specifiers: any[] = []) {
  return {
    type: 'ImportDeclaration',
    source: { 
      type: 'StringLiteral',
      value: source,
      span: { start: 0, end: 10 }
    },
    specifiers: specifiers.map(spec => ({
      ...spec,
      span: { start: 0, end: 10 }
    })),
    span: { start: 0, end: 10 }
  };
}

function createExportNode(isDefault: boolean = false, name?: string) {
  if (isDefault) {
    return {
      type: 'ExportDefaultDeclaration',
      declaration: {
        type: 'FunctionDeclaration',
        identifier: { value: name || 'default' }
      },
      span: { start: 0, end: 10 }
    };
  }
  return {
    type: 'ExportDeclaration',
    declaration: {
      type: 'FunctionDeclaration',
      identifier: { value: name || 'exported' }
    },
    span: { start: 0, end: 10 }
  };
}

describe('ModuleCompiler', () => {
  let compiler: ModuleCompiler;
  let mockTranspiler: any;
  let mockVfs: any;
  let mockParse: MockedFunction<any>;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Get mock instances
    const { transpiler } = await import('../../app/lib/transpiler');
    const { vfs } = await import('../../app/lib/filesystem');
    const { parse } = await import('@swc/wasm-web');
    
    mockTranspiler = transpiler;
    mockVfs = vfs;
    mockParse = parse as MockedFunction<any>;
    
    compiler = new ModuleCompiler();
  });

  describe('initialization', () => {
    it('should create compiler with default options', () => {
      const defaultCompiler = new ModuleCompiler();
      expect(defaultCompiler).toBeDefined();
    });

    it('should create compiler with custom options', () => {
      const options = {
        target: 'es2020' as const,
        jsx: false,
        enableSourceMaps: true,
        externals: ['custom-external']
      };
      
      const customCompiler = new ModuleCompiler(options);
      expect(customCompiler).toBeDefined();
    });
  });

  describe('CSS module compilation', () => {
    it('should compile CSS file to JavaScript module', async () => {
      const cssContent = '.test { color: red; }';
      mockVfs.readFile.mockResolvedValue(cssContent);

      const result = await compiler.compileModule('/styles.css');

      expect(result.code).toContain('define(\'/styles.css\'');
      expect(result.code).toContain(JSON.stringify(cssContent));
      expect(result.code).toContain('document.createElement(\'style\')');
      expect(result.dependencies).toEqual([]);
    });

    it('should handle CSS injection with unique IDs', async () => {
      const cssContent = '.another { background: blue; }';
      mockVfs.readFile.mockResolvedValue(cssContent);

      const result = await compiler.compileModule('/components/button.css');

      expect(result.code).toContain('style-');
      expect(result.code).toContain('data-module');
      expect(result.code).toContain('/components/button.css');
    });
  });

  describe('JavaScript/TypeScript module compilation', () => {
    beforeEach(() => {
      mockVfs.readFile.mockResolvedValue(`
        import React from 'react';
        import { Component } from './component';
        
        export default function App() {
          return React.createElement('div', null, 'Hello');
        }
      `);
      
      mockTranspiler.transpile.mockResolvedValue(`
        function App() {
          return React.createElement('div', null, 'Hello');
        }
      `);
      
      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: [
          createImportNode('./component', [
            { type: 'ImportSpecifier', local: { value: 'Component' }, imported: { value: 'Component' } }
          ])
        ]
      });
      
      mockVfs.exists.mockImplementation((path: string) => {
        return Promise.resolve(path === '/component.tsx');
      });
    });

    it('should compile TypeScript file with dependencies', async () => {
      const result = await compiler.compileModule('/main.tsx');

      expect(mockTranspiler.transpile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          filename: '/main.tsx',
          jsx: true,
          esm: true
        })
      );

      expect(result.code).toContain('define(\'/main.tsx\'');
      expect(result.dependencies).toContain('/component.tsx');
    });

    it('should handle file without dependencies', async () => {
      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: []
      });

      const result = await compiler.compileModule('/simple.ts');

      expect(result.dependencies).toEqual([]);
      expect(result.code).toContain('define(\'/simple.ts\'');
    });

    it('should resolve file extensions correctly', async () => {
      mockVfs.exists.mockImplementation((path: string) => {
        return Promise.resolve(path === '/utils/helper.ts');
      });

      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: [
          createImportNode('./utils/helper', [])
        ]
      });

      const result = await compiler.compileModule('/main.tsx');

      expect(result.dependencies).toContain('/utils/helper.ts');
    });
  });

  describe('AST transformation', () => {
    it('should extract import declarations correctly', async () => {
      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: [
          createImportNode('./component', [
            {
              type: 'ImportDefaultSpecifier',
              local: { value: 'Component' }
            }
          ]),
          createImportNode('./utils', [
            {
              type: 'ImportSpecifier',
              imported: { value: 'helper' },
              local: { value: 'helper' }
            }
          ])
        ]
      });

      mockVfs.exists.mockResolvedValue(true);

      const result = await compiler.compileModule('/main.tsx');

      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies).toContain('/component');
      expect(result.dependencies).toContain('/utils');
    });

    it('should handle namespace imports', async () => {
      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: [
          createImportNode('./utils', [
            {
              type: 'ImportNamespaceSpecifier',
              local: { value: 'Utils' }
            }
          ])
        ]
      });

      mockVfs.exists.mockResolvedValue(true);

      const result = await compiler.compileModule('/main.tsx');

      expect(result.dependencies).toContain('/utils');
    });

    it('should ignore external imports', async () => {
      const { moduleRegistry } = await import('../../app/lib/module-registry');
      vi.mocked(moduleRegistry.isExternal).mockImplementation((id: string) => {
        return id === 'react' || id === 'lodash';
      });

      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: [
          createImportNode('react', []),
          createImportNode('./component', [])
        ]
      });

      mockVfs.exists.mockResolvedValue(true);

      const result = await compiler.compileModule('/main.tsx');

      expect(result.dependencies).not.toContain('react');
      expect(result.dependencies).toContain('/component');
    });
  });

  describe('module wrapping', () => {
    it('should wrap module in AMD define format', async () => {
      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: [
          createExportNode(true, 'Component')
        ]
      });

      const result = await compiler.compileModule('/component.tsx');

      expect(result.code).toMatch(/define\s*\(\s*'\/component\.tsx'/);
      expect(result.code).toContain('function(require, module, exports)');
      expect(result.code).toContain('module.exports');
    });

    it('should generate require statements for dependencies', async () => {
      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: [
          createImportNode('./utils', [
            {
              type: 'ImportDefaultSpecifier',
              local: { value: 'utils' }
            }
          ])
        ]
      });

      mockVfs.exists.mockResolvedValue(true);

      const result = await compiler.compileModule('/main.tsx');

      expect(result.code).toContain('const __utils_module = require(\'/utils\')');
      expect(result.code).toContain('const utils = __utils_module.default');
    });

    it('should handle named imports correctly', async () => {
      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: [
          createImportNode('./utils', [
            {
              type: 'ImportSpecifier',
              imported: { value: 'helper' },
              local: { value: 'helper' }
            },
            {
              type: 'ImportSpecifier',
              imported: { value: 'validator' },
              local: { value: 'validate' }
            }
          ])
        ]
      });

      mockVfs.exists.mockResolvedValue(true);

      const result = await compiler.compileModule('/main.tsx');

      expect(result.code).toContain('const helper = __utils_module.helper');
      expect(result.code).toContain('const validate = __utils_module.validator');
    });
  });

  describe('path resolution', () => {
    beforeEach(() => {
      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: [
          createImportNode('../components/Button', [])
        ]
      });
    });

    it('should resolve relative paths correctly', async () => {
      mockVfs.exists.mockImplementation((path: string) => {
        return Promise.resolve(path === '/components/Button.tsx');
      });

      const result = await compiler.compileModule('/pages/Home.tsx');

      expect(result.dependencies).toContain('/components/Button.tsx');
    });

    it('should try multiple file extensions', async () => {
      let callCount = 0;
      mockVfs.exists.mockImplementation((path: string) => {
        callCount++;
        return Promise.resolve(path === '/components/Button.js');
      });

      const result = await compiler.compileModule('/pages/Home.tsx');

      expect(mockVfs.exists).toHaveBeenCalledWith('/components/Button');
      expect(mockVfs.exists).toHaveBeenCalledWith('/components/Button.tsx');
      expect(mockVfs.exists).toHaveBeenCalledWith('/components/Button.ts');
      expect(mockVfs.exists).toHaveBeenCalledWith('/components/Button.jsx');
      expect(mockVfs.exists).toHaveBeenCalledWith('/components/Button.js');
      expect(result.dependencies).toContain('/components/Button.js');
    });

    it('should try index files', async () => {
      mockVfs.exists.mockImplementation((path: string) => {
        return Promise.resolve(path === '/components/index.tsx');
      });

      mockTranspiler.parseCode.mockResolvedValue({
        type: 'Module',
        body: [
          createImportNode('../components', [])
        ]
      });

      const result = await compiler.compileModule('/pages/Home.tsx');

      expect(result.dependencies).toContain('/components/index.tsx');
    });
  });

  describe('caching and invalidation', () => {
    it('should cache compilation results', async () => {
      const result1 = await compiler.compileModule('/test.tsx');
      const result2 = await compiler.compileModule('/test.tsx');

      expect(mockVfs.readFile).toHaveBeenCalledOnce();
      expect(result1).toBe(result2);
    });

    it('should invalidate module and dependents', async () => {
      // Setup dependency chain: A -> B
      mockTranspiler.parseCode.mockResolvedValueOnce({
        type: 'Module',
        body: [
          {
            type: 'ImportDeclaration',
            source: { value: './B' },
            specifiers: []
          }
        ]
      });
      
      mockVfs.exists.mockResolvedValue(true);

      // Compile A (which depends on B)
      await compiler.compileModule('/A.tsx');
      
      // Compile B
      mockTranspiler.parseCode.mockResolvedValueOnce({
        type: 'Module',
        body: []
      });
      await compiler.compileModule('/B.tsx');

      // Clear mocks to track subsequent calls
      vi.clearAllMocks();
      mockVfs.readFile.mockResolvedValue('// updated code');

      // Invalidate B
      compiler.invalidateModule('/B.tsx');

      // Recompile B should read file again
      await compiler.compileModule('/B.tsx');
      expect(mockVfs.readFile).toHaveBeenCalledWith('/B.tsx');
    });

    it('should clear all cache', () => {
      compiler.clearCache();
      // Cache should be cleared (tested implicitly by recompilation)
      expect(() => compiler.clearCache()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle file read errors', async () => {
      mockVfs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(compiler.compileModule('/missing.tsx')).rejects.toThrow('File not found');
    });

    it('should handle transpilation errors', async () => {
      mockVfs.readFile.mockResolvedValue('const invalid = <div>unclosed');
      mockTranspiler.transpile.mockRejectedValue(new Error('Syntax error'));

      await expect(compiler.compileModule('/invalid.tsx')).rejects.toThrow('Syntax error');
    });

    it('should handle AST parsing errors gracefully', async () => {
      mockTranspiler.parseCode.mockRejectedValue(new Error('Parse error'));
      mockTranspiler.transpile.mockResolvedValue('// fallback transpiled code');

      // Should not throw, but return empty dependencies
      const result = await compiler.compileModule('/unparseable.tsx');
      expect(result.dependencies).toEqual([]);
    });
  });

  describe('dependency graph', () => {
    it('should build dependency graph correctly', async () => {
      mockTranspiler.parseCode.mockResolvedValueOnce({
        type: 'Module',
        body: [
          createImportNode('./B', []),
          createImportNode('./C', [])
        ]
      });
      mockTranspiler.transpile.mockResolvedValue('// transpiled code');

      mockVfs.exists.mockResolvedValue(true);

      await compiler.compileModule('/A.tsx');

      const graph = compiler.getDependencyGraph();
      expect(graph.get('/A.tsx')).toContain('/B');
      expect(graph.get('/A.tsx')).toContain('/C');
    });

    it('should return dependency graph', () => {
      const graph = compiler.getDependencyGraph();
      expect(graph).toBeInstanceOf(Map);
    });
  });
});