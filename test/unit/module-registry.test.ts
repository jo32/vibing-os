import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModuleRegistry } from '../../app/lib/module-registry';

// Mock window for browser environment
Object.defineProperty(global, 'window', {
  value: {
    React: undefined,
    ReactDOM: undefined,
    parent: undefined
  },
  writable: true
});

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    // Clear window globals
    (global.window as any).React = undefined;
    (global.window as any).ReactDOM = undefined;
    (global.window as any).parent = undefined;
    
    registry = new ModuleRegistry();
  });

  describe('initialization', () => {
    it('should initialize with default externals', () => {
      const externals = registry.getRegisteredModules();
      expect(externals).toContain('react');
      expect(externals).toContain('react-dom');
      expect(externals).toContain('@swc/wasm-web');
    });

    it('should register external libraries correctly', () => {
      registry.registerExternal('test-lib', () => ({ version: '1.0.0' }));
      expect(registry.isExternal('test-lib')).toBe(true);
    });
  });

  describe('module definition and loading', () => {
    it('should define a simple module', () => {
      const factory = vi.fn((require, module, exports) => {
        module.exports = { hello: 'world' };
      });

      registry.define('test-module', [], factory);
      expect(registry.getRegisteredModules()).toContain('test-module');
    });

    it('should load a module without dependencies', async () => {
      const factory = vi.fn((require, module, exports) => {
        module.exports = { value: 42 };
      });

      registry.define('simple-module', [], factory);
      const result = await registry.require('simple-module');

      expect(factory).toHaveBeenCalledOnce();
      expect(result).toEqual({ value: 42 });
    });

    it('should load modules with dependencies', async () => {
      // Define dependency first
      registry.define('dependency', [], (require, module, exports) => {
        module.exports = { dep: 'value' };
      });

      // Define module that uses dependency
      const mainFactory = vi.fn((require, module, exports) => {
        const dep = require('dependency');
        module.exports = { main: dep.dep };
      });

      registry.define('main-module', ['dependency'], mainFactory);
      const result = await registry.require('main-module');

      expect(result).toEqual({ main: 'value' });
      expect(mainFactory).toHaveBeenCalledOnce();
    });

    it('should cache module results', async () => {
      const factory = vi.fn((require, module, exports) => {
        module.exports = { cached: true };
      });

      registry.define('cached-module', [], factory);
      
      const result1 = await registry.require('cached-module');
      const result2 = await registry.require('cached-module');

      expect(factory).toHaveBeenCalledOnce();
      expect(result1).toBe(result2);
    });

    it('should handle module not found error', async () => {
      await expect(registry.require('non-existent')).rejects.toThrow('Module not found: non-existent');
    });

    it('should detect circular dependencies', async () => {
      registry.define('circular-a', ['circular-b'], (require, module, exports) => {
        const b = require('circular-b');
        module.exports = { a: true };
      });

      registry.define('circular-b', ['circular-a'], (require, module, exports) => {
        const a = require('circular-a');
        module.exports = { b: true };
      });

      await expect(registry.require('circular-a')).rejects.toThrow('Circular dependency detected');
    });
  });

  describe('external library handling', () => {
    it('should identify external libraries', () => {
      expect(registry.isExternal('react')).toBe(true);
      expect(registry.isExternal('react-dom')).toBe(true);
      expect(registry.isExternal('custom-module')).toBe(false);
    });

    it('should load external libraries', async () => {
      // Mock window.React for testing
      const mockReact = { createElement: vi.fn(), version: '18.0.0' };
      registry.registerExternal('react', () => mockReact);

      const result = await registry.require('react');
      expect(result).toBe(mockReact);
    });

    it('should handle external library registration', () => {
      const mockLib = { test: true };
      registry.registerExternal('test-external', () => mockLib);

      expect(registry.isExternal('test-external')).toBe(true);
    });
  });

  describe('dependency resolution', () => {
    it('should resolve complex dependency chains', async () => {
      // A -> B -> C
      registry.define('module-c', [], (require, module, exports) => {
        module.exports = { value: 'c' };
      });

      registry.define('module-b', ['module-c'], (require, module, exports) => {
        const c = require('module-c');
        module.exports = { value: 'b', c: c.value };
      });

      registry.define('module-a', ['module-b'], (require, module, exports) => {
        const b = require('module-b');
        module.exports = { value: 'a', b: b.value, c: b.c };
      });

      const result = await registry.require('module-a');
      expect(result).toEqual({ value: 'a', b: 'b', c: 'c' });
    });

    it('should handle multiple dependencies', async () => {
      registry.define('dep1', [], (require, module, exports) => {
        module.exports = { name: 'dep1' };
      });

      registry.define('dep2', [], (require, module, exports) => {
        module.exports = { name: 'dep2' };
      });

      registry.define('multi-dep', ['dep1', 'dep2'], (require, module, exports) => {
        const d1 = require('dep1');
        const d2 = require('dep2');
        module.exports = { deps: [d1.name, d2.name] };
      });

      const result = await registry.require('multi-dep');
      expect(result).toEqual({ deps: ['dep1', 'dep2'] });
    });
  });

  describe('error handling', () => {
    it('should handle factory function errors', async () => {
      registry.define('error-module', [], (require, module, exports) => {
        throw new Error('Factory error');
      });

      await expect(registry.require('error-module')).rejects.toThrow('Factory error');
    });

    it('should handle dependency not found in factory', async () => {
      registry.define('missing-dep', ['non-existent'], (require, module, exports) => {
        const dep = require('non-existent');
        module.exports = { dep };
      });

      await expect(registry.require('missing-dep')).rejects.toThrow('Module not found: non-existent');
    });

    it('should handle wrong dependency reference in factory', async () => {
      registry.define('dep', [], (require, module, exports) => {
        module.exports = { value: 'dep' };
      });

      registry.define('wrong-ref', ['dep'], (require, module, exports) => {
        const wrongDep = require('wrong-dep'); // Wrong reference
        module.exports = { wrongDep };
      });

      await expect(registry.require('wrong-ref')).rejects.toThrow('Dependency wrong-dep not found');
    });
  });

  describe('clearing and reset', () => {
    it('should clear registry correctly', () => {
      registry.define('test', [], () => {});
      expect(registry.getRegisteredModules()).toContain('test');

      registry.clear();
      
      // Should still have externals after clear
      expect(registry.isExternal('react')).toBe(true);
      // But not custom modules
      expect(registry.getRegisteredModules()).not.toContain('test');
    });
  });

  describe('concurrent loading', () => {
    it('should handle concurrent requests for the same module', async () => {
      const factory = vi.fn((require, module, exports) => {
        module.exports = { concurrent: true };
      });

      registry.define('concurrent-module', [], factory);

      // Load the same module concurrently
      const promises = Array(5).fill(null).map(() => registry.require('concurrent-module'));
      const results = await Promise.all(promises);

      // Factory should only be called once
      expect(factory).toHaveBeenCalledOnce();
      
      // All results should be the same instance
      results.forEach((result, index) => {
        expect(result).toBe(results[0]);
      });
    });
  });
});