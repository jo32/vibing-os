'use client';

interface ModuleInfo {
  id: string;
  dependencies: string[];
  factory: ModuleFactory;
  exports?: any;
  loaded?: boolean;
  loading?: boolean;
  getter?: () => any;
}

type ModuleFactory = (require: RequireFunction, module: Module, exports: any) => void;
type RequireFunction = (id: string) => any;

interface Module {
  exports: any;
  id: string;
  loaded: boolean;
}

export class ModuleRegistry {
  private modules = new Map<string, ModuleInfo>();
  private loadingPromises = new Map<string, Promise<any>>();
  private externalLibraries = new Set(['react', 'react-dom', '@swc/wasm-web']);

  constructor() {
    this.setupExternals();
  }

  private setupExternals() {
    // Register external libraries that are available globally
    if (typeof window !== 'undefined') {
      this.registerExternal('react', () => window.React);
      this.registerExternal('react-dom', () => window.ReactDOM);
    }
    this.registerExternal('@swc/wasm-web', () => {
      throw new Error('@swc/wasm-web should not be imported in compiled modules');
    });
  }

  registerExternal(id: string, getter: () => any) {
    this.externalLibraries.add(id);
    this.modules.set(id, {
      id,
      dependencies: [],
      factory: () => {},
      exports: null,
      loaded: false,
      getter
    });
  }

  define(id: string, dependencies: string[], factory: ModuleFactory) {
    if (this.modules.has(id) && this.modules.get(id)?.loaded) {
      console.warn(`Module ${id} already registered and loaded`);
      return;
    }

    this.modules.set(id, {
      id,
      dependencies,
      factory,
      loaded: false,
      loading: false
    });

    console.log(`📦 Registered module: ${id} with dependencies: [${dependencies.join(', ')}]`);
  }

  async require(id: string): Promise<any> {
    const moduleInfo = this.modules.get(id);
    
    // Handle external modules with getters
    if (moduleInfo?.getter) {
      if (!moduleInfo.loaded) {
        moduleInfo.exports = moduleInfo.getter();
        moduleInfo.loaded = true;
      }
      return moduleInfo.exports;
    }
    
    // Check if already loaded
    if (moduleInfo?.loaded) {
      return moduleInfo.exports;
    }

    // Check if currently loading
    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id);
    }

    // Start loading
    const loadPromise = this.loadModule(id);
    this.loadingPromises.set(id, loadPromise);

    try {
      const result = await loadPromise;
      this.loadingPromises.delete(id);
      return result;
    } catch (error) {
      this.loadingPromises.delete(id);
      throw error;
    }
  }

  private async loadModule(id: string): Promise<any> {
    const moduleInfo = this.modules.get(id);
    if (!moduleInfo) {
      throw new Error(`Module not found: ${id}`);
    }

    if (moduleInfo.loaded) {
      return moduleInfo.exports;
    }

    if (moduleInfo.loading) {
      throw new Error(`Circular dependency detected: ${id}`);
    }

    console.log(`🔄 Loading module: ${id}`);
    moduleInfo.loading = true;

    try {
      // Load dependencies first
      const dependencyExports = await Promise.all(
        moduleInfo.dependencies.map(depId => this.require(depId))
      );

      // Create module context
      const module: Module = {
        exports: {},
        id,
        loaded: false
      };

      const require: RequireFunction = (requiredId: string) => {
        const depIndex = moduleInfo.dependencies.indexOf(requiredId);
        if (depIndex !== -1) {
          return dependencyExports[depIndex];
        }
        throw new Error(`Dependency ${requiredId} not found for module ${id}`);
      };

      // Execute module factory
      moduleInfo.factory(require, module, module.exports);

      // Mark as loaded
      moduleInfo.exports = module.exports;
      moduleInfo.loaded = true;
      moduleInfo.loading = false;
      module.loaded = true;

      console.log(`✅ Loaded module: ${id}`);
      return module.exports;

    } catch (error) {
      moduleInfo.loading = false;
      console.error(`❌ Failed to load module ${id}:`, error);
      throw error;
    }
  }

  isExternal(id: string): boolean {
    return this.externalLibraries.has(id);
  }

  getRegisteredModules(): string[] {
    return Array.from(this.modules.keys());
  }

  clear() {
    this.modules.clear();
    this.loadingPromises.clear();
    this.setupExternals();
  }
}

export const moduleRegistry = new ModuleRegistry();

// Global module system for browser compatibility
if (typeof window !== 'undefined') {
  (window as any).__moduleRegistry = moduleRegistry;
  (window as any).define = moduleRegistry.define.bind(moduleRegistry);
  (window as any).require = moduleRegistry.require.bind(moduleRegistry);
}