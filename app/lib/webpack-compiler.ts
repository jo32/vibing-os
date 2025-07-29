'use client';

import { moduleRegistry } from './module-registry';
import { moduleCompiler } from './module-compiler';
import { externalHandler } from './external-handler';
import { vfs } from './filesystem';

interface CompilerOptions {
  entryPoint?: string;
  includeTailwind?: boolean;
  target?: 'es2022' | 'es2020' | 'es2015';
  externals?: string[];
}

interface BuildResult {
  compiledCode: string;
  modules: string[];
  dependencies: Map<string, Set<string>>;
}

export class WebpackLikeCompiler {
  private buildCache = new Map<string, BuildResult>();
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;


    try {
      // Initialize filesystem
      await vfs.init();
      
      // Setup external libraries
      await externalHandler.ensureReactRuntime();
      await externalHandler.preloadCommonLibraries();

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize compiler:', error);
      throw error;
    }
  }

  async build(options: CompilerOptions = {}): Promise<BuildResult> {
    const {
      entryPoint = '/main.tsx',
      includeTailwind = true,
      target = 'es2022',
      externals = []
    } = options;

    await this.ensureInitialized();

    // Check cache
    const cacheKey = JSON.stringify(options);
    if (this.buildCache.has(cacheKey)) {
      return this.buildCache.get(cacheKey)!;
    }


    try {
      // Clear previous build
      moduleRegistry.clear();
      moduleCompiler.clearCache();

      // Register additional externals
      for (const external of externals) {
        if (!externalHandler.isExternal(external)) {
          externalHandler.register(external, {
            name: external,
            url: `https://esm.run/${external}@latest`
          });
        }
      }

      // Compile all modules starting from entry point
      const compiledModules = await this.compileModuleTree(entryPoint);

      // Create the runtime bundle with embedded module definitions
      const runtimeCode = await this.createRuntimeBundle(entryPoint, includeTailwind, compiledModules);

      const buildResult: BuildResult = {
        compiledCode: runtimeCode,
        modules: Array.from(compiledModules.keys()),
        dependencies: moduleCompiler.getDependencyGraph()
      };

      // Cache the result
      this.buildCache.set(cacheKey, buildResult);

      return buildResult;

    } catch (error) {
      console.error('❌ Build failed:', error);
      throw error;
    }
  }

  private async compileModuleTree(entryPoint: string): Promise<Map<string, any>> {
    const compiledModules = new Map();
    const visitedModules = new Set<string>();
    const compilationQueue = [entryPoint];

    while (compilationQueue.length > 0) {
      const moduleId = compilationQueue.shift()!;
      
      if (visitedModules.has(moduleId) || externalHandler.isExternal(moduleId)) {
        continue;
      }

      visitedModules.add(moduleId);

      try {
        const compilationResult = await moduleCompiler.compileModule(moduleId);
        compiledModules.set(moduleId, compilationResult);

        // Add dependencies to compilation queue
        for (const dep of compilationResult.dependencies) {
          if (!visitedModules.has(dep) && !externalHandler.isExternal(dep)) {
            compilationQueue.push(dep);
          }
        }

      } catch (error) {
        console.error(`❌ Failed to compile ${moduleId}:`, error);
        // Create error module
        const errorModule = {
          code: `define('${moduleId}', [], function(require, module, exports) {
            console.error('Module compilation failed: ${moduleId}');
            module.exports = { default: () => null };
          });`,
          dependencies: []
        };
        compiledModules.set(moduleId, errorModule);
      }
    }

    return compiledModules;
  }

  private async executeModuleCode(code: string): Promise<void> {
    try {
      // Execute the module definition code in the global scope
      eval(code);
    } catch (error) {
      console.error('Failed to execute module code:', error);
      throw error;
    }
  }

  private async createRuntimeBundle(entryPoint: string, includeTailwind: boolean, compiledModules: Map<string, any>): Promise<string> {
    
    const moduleRegistryCode = await this.getModuleRegistryCode();
    const externalSetupCode = await this.getExternalSetupCode();
    const tailwindCode = includeTailwind ? await this.getTailwindSetupCode() : '';
    
    // Generate module definitions code
    const moduleDefinitionsCode = this.generateModuleDefinitions(compiledModules);
    
    
    const runtime = `
// Webpack-like Runtime Bundle
(async () => {
console.log('🚀 Starting webpack-like runtime...');

// Module registry and loader
${moduleRegistryCode}

// External library setup
${externalSetupCode}

// CSS injection (Tailwind if enabled)
${tailwindCode}

// Module definitions
${moduleDefinitionsCode}

// Application bootstrap
async function bootstrapApplication() {
  try {
    console.log('🔧 Bootstrapping application...');
    
    // Wait for external setup to complete
    if (window.__setupExternalsPromise) {
      await window.__setupExternalsPromise;
    }
    
    // Ensure React runtime is available
    if (!window.React || !window.ReactDOM) {
      throw new Error('React runtime not available');
    }
    
    // Load the main application module
    console.log('📦 Loading main module: ${entryPoint}');
    const mainModule = await require('${entryPoint}');
    
    // Get the App component
    const App = mainModule.default || mainModule.App || mainModule;
    if (typeof App !== 'function') {
      throw new Error('Main module does not export a valid React component');
    }
    
    // Mount the application
    const rootElement = window.__vibing_container || document.getElementById('root') || document.body;
    
    // Ensure the app is constrained to its container when in preview mode
    if (window.__vibing_container) {
      // Add a unique class to the container for scoped styling
      window.__vibing_container.classList.add('vibing-preview-container');
      
      // Inject scoped CSS that only affects the preview container
      if (!document.querySelector('#vibing-container-styles')) {
        const style = document.createElement('style');
        style.id = 'vibing-container-styles';
        style.textContent = \`
          .vibing-preview-container .min-h-screen {
            min-height: 100% !important;
            height: auto !important;
          }
          .vibing-preview-container .h-screen {
            height: 100% !important;
          }
          .vibing-preview-container {
            height: 100% !important;
            overflow: auto !important;
            position: relative !important;
          }
        \`;
        document.head.appendChild(style);
      }
    }
    
    // Reuse existing root or create new one
    if (!window.__reactRoot) {
      window.__reactRoot = window.ReactDOM.createRoot(rootElement);
    }
    window.__reactRoot.render(window.React.createElement(App));
    
    console.log('✅ Application mounted successfully');
    
  } catch (error) {
    console.error('❌ Failed to bootstrap application:', error);
    
    // Show error in UI
    const rootElement = window.__vibing_container || document.getElementById('root') || document.body;
    
    // Reuse existing root or create new one for error display
    if (!window.__reactRoot) {
      window.__reactRoot = window.ReactDOM.createRoot(rootElement);
    }
    const ErrorComponent = () => window.React.createElement('div', {
      style: { 
        padding: '20px', 
        color: 'red', 
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap'
      }
    }, \`Application Error:\\n\\n\${error.message}\\n\\n\${error.stack || ''}\`);
    
    window.__reactRoot.render(window.React.createElement(ErrorComponent));
  }
}

// Start the application
await bootstrapApplication();
})();
`;

    return runtime;
  }

  private async getModuleRegistryCode(): Promise<string> {
    // Return the essential module registry code inline
    return `
// Module registry implementation
const modules = new Map();
const moduleCache = new Map();
const loadingModules = new Set();

window.define = function(id, dependencies, factory) {
  if (modules.has(id)) {
    console.warn('Module already defined:', id);
    return;
  }
  
  modules.set(id, { id, dependencies, factory });
  console.log('📦 Defined module:', id);
};

window.require = async function(id) {
  if (moduleCache.has(id)) {
    return moduleCache.get(id);
  }
  
  if (loadingModules.has(id)) {
    throw new Error('Circular dependency detected: ' + id);
  }
  
  const moduleInfo = modules.get(id);
  if (!moduleInfo) {
    throw new Error('Module not found: ' + id);
  }
  
  loadingModules.add(id);
  
  try {
    // Load dependencies
    const dependencyExports = await Promise.all(
      moduleInfo.dependencies.map(depId => window.require(depId))
    );
    
    // Create module context
    const module = { exports: {}, id, loaded: false };
    const require = (depId) => {
      const depIndex = moduleInfo.dependencies.indexOf(depId);
      if (depIndex !== -1) {
        return dependencyExports[depIndex];
      }
      throw new Error('Dependency not found: ' + depId);
    };
    
    // Execute factory
    moduleInfo.factory(require, module, module.exports);
    
    // Cache and return exports
    module.loaded = true;
    moduleCache.set(id, module.exports);
    loadingModules.delete(id);
    
    console.log('✅ Loaded module:', id);
    return module.exports;
    
  } catch (error) {
    loadingModules.delete(id);
    console.error('Failed to load module:', id, error);
    throw error;
  }
};
`;
  }

  private async getExternalSetupCode(): Promise<string> {
    return `
// External library setup
async function setupExternals() {
  console.log('🔧 Setting up external libraries...');
  
  // React setup with comprehensive fallbacks
  if (!window.React) {
    if (window.parent && window.parent.React) {
      window.React = window.parent.React;
      window.ReactDOM = window.parent.ReactDOM;
      console.log('✅ Using React from parent window');
    } else {
      // Fallback to CDN
      try {
        const ReactModule = await import('https://esm.run/react@18');
        const ReactDOMModule = await import('https://esm.run/react-dom@18/client');
        window.React = ReactModule.default || ReactModule;
        window.ReactDOM = ReactDOMModule.default || ReactDOMModule;
        console.log('✅ Loaded React from CDN');
      } catch (error) {
        console.error('❌ Failed to load React:', error);
        throw error;
      }
    }
  }
  
  // Verify React hooks
  const requiredHooks = ['useState', 'useEffect', 'useContext', 'useReducer'];
  const missingHooks = requiredHooks.filter(hook => typeof window.React[hook] !== 'function');
  
  if (missingHooks.length > 0) {
    console.error('❌ Missing React hooks:', missingHooks);
    throw new Error('React hooks not available: ' + missingHooks.join(', '));
  }
  
  // Make React hooks and core functions available globally for compiled modules
  window.useState = window.React.useState;
  window.useEffect = window.React.useEffect;
  window.useContext = window.React.useContext;
  window.useReducer = window.React.useReducer;
  window.useCallback = window.React.useCallback;
  window.useMemo = window.React.useMemo;
  window.useRef = window.React.useRef;
  window.useImperativeHandle = window.React.useImperativeHandle;
  window.useLayoutEffect = window.React.useLayoutEffect;
  window.useDebugValue = window.React.useDebugValue;
  
  // Make React core functions available globally
  window.createElement = window.React.createElement;
  window.Fragment = window.React.Fragment;
  
  console.log('✅ External libraries ready');
}

// Setup externals and make it available globally
window.__setupExternalsPromise = setupExternals();
`;
  }

  private async getTailwindSetupCode(): Promise<string> {
    return `
// Tailwind CSS setup
if (!document.querySelector('link[href*="tailwind"]') && 
    !document.querySelector('style[data-tailwind]')) {
  const tailwindLink = document.createElement('link');
  tailwindLink.rel = 'stylesheet';
  tailwindLink.href = 'https://cdn.tailwindcss.com';
  tailwindLink.setAttribute('data-tailwind', 'true');
  document.head.appendChild(tailwindLink);
  console.log('🎨 Tailwind CSS loaded');
}
`;
  }

  private generateModuleDefinitions(compiledModules: Map<string, any>): string {
    
    const definitions = [];
    for (const [moduleId, compilationResult] of Array.from(compiledModules.entries())) {
      definitions.push(compilationResult.code);
    }
    
    return definitions.join('\n\n');
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  // Execute compiled code and render the application
  async executeAndRender(buildResult: BuildResult, container?: HTMLElement): Promise<void> {
    try {
      console.log('🚀 Executing compiled code and rendering application...');
      
      // Set up global container reference if provided
      if (container) {
        // Clean up any existing container reference first
        if ((window as any).__vibing_container) {
          delete (window as any).__vibing_container;
        }
        (window as any).__vibing_container = container;
      }
      
      // Execute the runtime bundle to set up the module system and externals
      
      // Check for await statements
      const awaitMatches = buildResult.compiledCode.match(/await /g);
      if (awaitMatches) {
        const lines = buildResult.compiledCode.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('await ')) {
          }
        });
      }
      
      eval(buildResult.compiledCode);
      
      // Don't clean up container reference immediately - let React finish mounting
      // The container reference will be cleaned up on the next render
      
      console.log('✅ Application rendered successfully');
      
    } catch (error) {
      console.error('❌ Failed to execute and render application:', error);
      throw error;
    }
  }

  // Hot reload functionality
  async hotReload(moduleId: string): Promise<void> {
    console.log(`🔥 Hot reloading module: ${moduleId}`);
    
    try {
      // Invalidate module and its dependents
      moduleCompiler.invalidateModule(moduleId);
      
      // Recompile the module
      const compilationResult = await moduleCompiler.compileModule(moduleId);
      
      // Execute the new module code
      await this.executeModuleCode(compilationResult.code);
      
      console.log(`✅ Hot reload complete for: ${moduleId}`);
      
    } catch (error) {
      console.error(`❌ Hot reload failed for ${moduleId}:`, error);
      throw error;
    }
  }

  // Debug utilities
  getStats() {
    return {
      modules: moduleRegistry.getRegisteredModules(),
      externals: externalHandler.getRegisteredExternals(),
      dependencyGraph: moduleCompiler.getDependencyGraph()
    };
  }

  clearCache() {
    this.buildCache.clear();
    moduleCompiler.clearCache();
    moduleRegistry.clear();
  }
}

export const webpackCompiler = new WebpackLikeCompiler();

// Make debugging available globally
if (typeof window !== 'undefined') {
  (window as any).__webpackCompiler = webpackCompiler;
}