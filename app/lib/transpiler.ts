'use client';

import init, { transform, parse } from '@swc/wasm-web';

interface TranspilerOptions {
  filename?: string;
  jsx?: boolean;
  esm?: boolean;
}

interface PackageVersion {
  version: string;
  cachedAt: number;
}

interface PackageCache {
  [packageName: string]: PackageVersion;
}

export class Transpiler {
  private initialized = false;
  private packageCache: PackageCache = {};
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  async init() {
    if (this.initialized) return;
    
    try {
      // Initialize SWC WASM in browser environment
      await init();
      
      this.initialized = true;
      console.log('SWC transpiler initialized');
      
      // Load cached package versions from localStorage
      this.loadPackageCache();
    } catch (error) {
      console.error('Failed to initialize SWC:', error);
      throw error;
    }
  }

  async parseCode(code: string, options: any): Promise<any> {
    await this.ensureInitialized();
    
    try {
      return await parse(code, options);
    } catch (error) {
      console.error('Parse error:', error);
      throw error;
    }
  }

  async transpile(code: string, options: TranspilerOptions = {}): Promise<string> {
    await this.ensureInitialized();
    
    const { filename = 'file.tsx', jsx = true, esm = true } = options;
    
    // Handle CSS files
    if (filename.endsWith('.css')) {
      return this.handleCssFile(code, filename);
    }
    
    // Remove external library imports before transpilation
    const cleanedCode = await this.removeExternalImports(code);
    
    try {
      const result = await transform(cleanedCode, {
        filename,
        jsc: {
          parser: {
            syntax: filename.endsWith('.ts') || filename.endsWith('.tsx') ? 'typescript' : 'ecmascript',
            tsx: jsx && (filename.endsWith('.tsx') || filename.endsWith('.jsx')),
            jsx: jsx && (filename.endsWith('.tsx') || filename.endsWith('.jsx')),
          },
          transform: {
            react: {
              runtime: 'classic',
              pragma: 'React.createElement',
              pragmaFrag: 'React.Fragment',
            },
          },
          target: 'es2022',
        },
        module: {
          type: esm ? 'es6' : 'commonjs',
        },
        sourceMaps: false,
      });
      
      // Auto-inject esm.run imports for common libraries (excluding React)
      let transpiledCode = result.code;
      transpiledCode = await this.injectEsmRunImports(transpiledCode);
      
      return transpiledCode;
    } catch (error) {
      console.error('Transpilation error:', error);
      throw error;
    }
  }

  private async getLatestVersion(packageName: string): Promise<string> {
    const cached = this.packageCache[packageName];
    const now = Date.now();
    
    // Check if we have a cached version that's still valid
    if (cached && (now - cached.cachedAt) < this.CACHE_DURATION) {
      return cached.version;
    }
    
    try {
      const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
      if (!response.ok) {
        throw new Error(`Failed to fetch package info: ${response.status}`);
      }
      
      const data = await response.json();
      const version = data.version;
      
      // Cache the result
      this.packageCache[packageName] = {
        version,
        cachedAt: now
      };
      
      // Save to localStorage
      this.savePackageCache();
      
      return version;
    } catch (error) {
      console.warn(`Failed to fetch latest version for ${packageName}:`, error);
      
      // Return cached version if available, otherwise return a fallback
      if (cached) {
        return cached.version;
      }
      
      // Fallback versions for common packages
      const fallbackVersions: Record<string, string> = {
        'react': '18',
        'react-dom': '18',
        'lodash': '4',
        'axios': '1',
        'dayjs': '1',
        'uuid': '9',
        'classnames': '2',
        'clsx': '2',
      };
      
      return fallbackVersions[packageName] || 'latest';
    }
  }

  private async injectEsmRunImports(code: string): Promise<string> {
    await this.ensureInitialized();
    
    try {
      // Parse the code to AST using SWC
      const ast = await parse(code, {
        syntax: 'typescript',
        tsx: true,
      });
      
      // Extract import declarations
      const packages = new Set<string>();
      const importInfos: Array<{
        packageName: string;
        mainPackage: string;
        start: number;
        end: number;
        source: string;
      }> = [];
      
      // Walk through the AST to find import declarations
      this.walkAst(ast, (node: any) => {
        if (node.type === 'ImportDeclaration') {
          const source = node.source.type === 'StringLiteral' ? node.source.value : node.source;
          
          // Only process packages that don't start with . or / (relative imports) and don't contain :// (URLs)
          if (!source.startsWith('.') && !source.startsWith('/') && !source.includes('://')) {
            // Extract the main package name (before any subpath)
            const mainPackage = source.split('/')[0];
            packages.add(mainPackage);
            
            importInfos.push({
              packageName: source,
              mainPackage,
              start: node.span.start,
              end: node.span.end,
              source,
            });
          }
        }
      });
      
      // Get latest versions for all packages
      const versionPromises = Array.from(packages).map(async (packageName) => {
        const version = await this.getLatestVersion(packageName);
        return { packageName, version };
      });
      
      const packageVersions = await Promise.all(versionPromises);
      const versionMap = new Map(packageVersions.map(({ packageName, version }) => [packageName, version]));
      
      // Replace import sources from end to start to maintain positions
      let modifiedCode = code;
      const sortedImports = importInfos.sort((a, b) => b.start - a.start);
      
      for (const importInfo of sortedImports) {
        // Skip React and ReactDOM imports since we provide them globally
        if (importInfo.mainPackage === 'react' || importInfo.mainPackage === 'react-dom') {
          // Remove the entire import statement
          const beforeImport = modifiedCode.substring(0, importInfo.start);
          const afterImport = modifiedCode.substring(importInfo.end);
          modifiedCode = beforeImport + afterImport;
          continue;
        }
        
        const version = versionMap.get(importInfo.mainPackage) || 'latest';
        let esmRunUrl = `https://esm.run/${importInfo.mainPackage}@${version}`;
        
        // Handle subpath imports
        if (importInfo.packageName !== importInfo.mainPackage) {
          const subpath = importInfo.packageName.substring(importInfo.mainPackage.length);
          esmRunUrl += subpath;
        }
        
        // Find the import declaration in the code and replace the source
        const beforeImport = modifiedCode.substring(0, importInfo.start);
        const afterImport = modifiedCode.substring(importInfo.end);
        const importDeclaration = modifiedCode.substring(importInfo.start, importInfo.end);
        
        // Replace the source in the import declaration
        const newImportDeclaration = importDeclaration.replace(
          /from\s+['"`]([^'"`]+)['"`]/,
          `from '${esmRunUrl}'`
        );
        
        modifiedCode = beforeImport + newImportDeclaration + afterImport;
      }
      
      return modifiedCode;
    } catch (error) {
      console.warn('Failed to parse AST, falling back to original code:', error);
      return code;
    }
  }

  private walkAst(node: any, visitor: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;
    
    visitor(node);
    
    // Recursively walk through all properties
    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(item => this.walkAst(item, visitor));
        } else if (typeof child === 'object' && child !== null) {
          this.walkAst(child, visitor);
        }
      }
    }
  }

  private loadPackageCache(): void {
    try {
      const cached = localStorage.getItem('vibing-os-package-cache');
      if (cached) {
        this.packageCache = JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Failed to load package cache:', error);
    }
  }

  private savePackageCache(): void {
    try {
      localStorage.setItem('vibing-os-package-cache', JSON.stringify(this.packageCache));
    } catch (error) {
      console.warn('Failed to save package cache:', error);
    }
  }

  private handleCssFile(code: string, filename: string): string {
    // Convert CSS to JavaScript module that injects styles
    const escapedCss = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    
    return `
// CSS Module: ${filename}
const css = \`${escapedCss}\`;

// Create or update style element
let styleElement = document.querySelector('style[data-css-file="${filename}"]');
if (!styleElement) {
  styleElement = document.createElement('style');
  styleElement.setAttribute('data-css-file', '${filename}');
  document.head.appendChild(styleElement);
}
styleElement.textContent = css;

// Export for ES module compatibility
export default css;
export { css };
`;
  }

  private async removeExternalImports(code: string): Promise<string> {
    try {
      console.log('🔧 Removing external library imports from code...');
      console.log('Original code:', code.substring(0, 200) + '...');
      
      // Split code into lines for safer manipulation
      const lines = code.split('\n');
      const filteredLines: string[] = [];
      let removedImports = 0;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip lines that import external libraries (not relative imports starting with . or /)
        if (trimmedLine.startsWith('import')) {
          // Check if it's an external library import (not starting with . or /)
          const fromMatch = trimmedLine.match(/from\s+['"]([^'"]+)['"]/);
          const directImportMatch = trimmedLine.match(/import\s+['"]([^'"]+)['"]/);
          
          const importPath = fromMatch?.[1] || directImportMatch?.[1];
          
          if (importPath && !importPath.startsWith('.') && !importPath.startsWith('/')) {
            // This is an external library import - remove it
            console.log(`❌ Removing external library import: ${trimmedLine}`);
            removedImports++;
            continue;
          }
        }
        
        filteredLines.push(line);
      }
      
      const result = filteredLines.join('\n');
      console.log(`✅ Removed ${removedImports} external library imports`);
      console.log('Code after external import removal:', result.substring(0, 200) + '...');
      
      return result;
    } catch (error) {
      console.warn('Failed to remove external library imports, using original code:', error);
      return code;
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }
}

export const transpiler = new Transpiler();