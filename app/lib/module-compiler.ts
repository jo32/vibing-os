'use client';

import { transpiler } from './transpiler';
import { vfs } from './filesystem';
import { moduleRegistry } from './module-registry';

interface CompilationResult {
  code: string;
  dependencies: string[];
  sourceMap?: string;
}

interface ModuleCompilerOptions {
  target?: 'es2022' | 'es2020' | 'es2015';
  jsx?: boolean;
  enableSourceMaps?: boolean;
  externals?: string[];
}

export class ModuleCompiler {
  private compilationCache = new Map<string, CompilationResult>();
  private dependencyGraph = new Map<string, Set<string>>();
  private options: Required<ModuleCompilerOptions>;

  constructor(options: ModuleCompilerOptions = {}) {
    this.options = {
      target: 'es2022',
      jsx: true,
      enableSourceMaps: false,
      externals: ['react', 'react-dom', '@swc/wasm-web'],
      ...options
    };
  }

  async compileModule(id: string): Promise<CompilationResult> {
    // Check cache first
    if (this.compilationCache.has(id)) {
      return this.compilationCache.get(id)!;
    }

    console.log(`🔧 Compiling module: ${id}`);

    try {
      // Read source code
      const sourceCode = await vfs.readFile(id);
      
      // Compile based on file type
      let result: CompilationResult;
      
      if (id.endsWith('.css') || id.endsWith('.scss') || id.endsWith('.sass')) {
        result = await this.compileCSSModule(id, sourceCode);
      } else {
        result = await this.compileJSModule(id, sourceCode);
      }

      // Cache result
      this.compilationCache.set(id, result);
      this.dependencyGraph.set(id, new Set(result.dependencies));

      console.log(`✅ Compiled module ${id}: ${result.code.length} chars, ${result.dependencies.length} deps`);
      return result;

    } catch (error) {
      console.error(`❌ Compilation failed for ${id}:`, error);
      throw error;
    }
  }

  private async compileJSModule(id: string, sourceCode: string): Promise<CompilationResult> {
    // Extract dependencies before transpilation
    const dependencies = await this.extractDependencies(sourceCode, id);
    
    // Filter out external dependencies
    const internalDeps = dependencies.filter(dep => !this.isExternal(dep));

    // Transform code with AST manipulation for webpack-like module system
    const transformedCode = await this.transformToModuleFormat(sourceCode, id, dependencies);

    return {
      code: transformedCode,
      dependencies: internalDeps
    };
  }

  private async compileCSSModule(id: string, sourceCode: string): Promise<CompilationResult> {
    // Convert CSS to JavaScript module
    const cssModuleCode = `
define('${id}', [], function(require, module, exports) {
  const css = ${JSON.stringify(sourceCode)};
  
  // Inject CSS into document
  const styleId = 'style-' + ${JSON.stringify(id.replace(/[^a-zA-Z0-9]/g, '_'))};
  let styleElement = document.getElementById(styleId);
  
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.setAttribute('data-module', ${JSON.stringify(id)});
    document.head.appendChild(styleElement);
  }
  
  styleElement.textContent = css;
  
  module.exports = css;
});
`;

    return {
      code: cssModuleCode,
      dependencies: []
    };
  }

  private async transformToModuleFormat(sourceCode: string, id: string, dependencies: string[]): Promise<string> {
    // First transpile with SWC
    const transpiledCode = await transpiler.transpile(sourceCode, {
      filename: id,
      jsx: this.options.jsx,
      esm: true
    });

    // Transform to webpack-like module format
    const moduleCode = await this.wrapInModuleDefinition(transpiledCode, id, dependencies);
    
    return moduleCode;
  }

  private async wrapInModuleDefinition(code: string, id: string, dependencies: string[]): Promise<string> {
    let imports: Array<{
      source: string;
      specifiers: Array<{ name: string; alias: string; isDefault: boolean }>;
      start: number;
      end: number;
    }> = [];

    let exports: Array<{ name: string; isDefault: boolean }> = [];

    try {
      // Parse AST to understand imports/exports using transpiler
      const ast = await transpiler.parseCode(code, {
        syntax: 'typescript',
        tsx: this.options.jsx
      });

      // Extract imports and exports
      this.walkAst(ast, (node: any) => {
      if (node.type === 'ImportDeclaration') {
        const source = node.source.value;
        const specifiers: Array<{ name: string; alias: string; isDefault: boolean }> = [];

        if (node.specifiers) {
          for (const spec of node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier') {
              specifiers.push({
                name: 'default',
                alias: spec.local?.value || 'default',
                isDefault: true
              });
            } else if (spec.type === 'ImportSpecifier') {
              specifiers.push({
                name: spec.imported?.value || spec.local?.value,
                alias: spec.local?.value,
                isDefault: false
              });
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              specifiers.push({
                name: '*',
                alias: spec.local?.value || 'namespace',
                isDefault: false
              });
            }
          }
        }

        imports.push({
          source,
          specifiers,
          start: node.span.start,
          end: node.span.end
        });
      } else if (node.type === 'ExportDefaultDeclaration') {
        exports.push({ name: 'default', isDefault: true });
      } else if (node.type === 'ExportDeclaration') {
        if (node.declaration?.type === 'FunctionDeclaration') {
          exports.push({ name: node.declaration.identifier.value, isDefault: false });
        } else if (node.declaration?.type === 'VariableDeclaration') {
          for (const decl of node.declaration.declarations) {
            if (decl.id?.type === 'Identifier') {
              exports.push({ name: decl.id.value, isDefault: false });
            }
          }
        }
      }
    });

    } catch (error) {
      console.warn('Failed to parse AST, falling back to original code:', error);
      // Fall back to empty imports/exports - dependencies were already extracted separately
    }

    // Remove import statements and process code
    let processedCode = this.removeImportStatements(code);
    processedCode = this.removeExportKeywords(processedCode);

    // Generate require statements for internal dependencies
    const internalImports = imports.filter(imp => !this.isExternal(imp.source));
    const requireStatements = this.generateRequireStatements(internalImports, dependencies, id);

    // Generate module exports
    const exportStatements = this.generateExportStatements(exports, processedCode);

    // Wrap in module definition
    const dependencyIds = dependencies.map(dep => `'${dep}'`).join(', ');
    
    const moduleDefinition = `
define('${id}', [${dependencyIds}], function(require, module, exports) {
  ${requireStatements}
  
  ${processedCode}
  
  ${exportStatements}
});
`;

    return moduleDefinition;
  }

  private removeImportStatements(code: string): string {
    // Remove all import statements using regex
    return code
      .replace(/^\s*import\s+[^;]+;?\s*$/gm, '')
      .replace(/^\s*export\s+\{[^}]*\}\s+from\s+[^;]+;?\s*$/gm, '')
      .replace(/^\s*export\s+\*\s+from\s+[^;]+;?\s*$/gm, '');
  }

  private removeExportKeywords(code: string): string {
    return code
      .replace(/export\s+default\s+function/g, 'function')
      .replace(/export\s+function/g, 'function')
      .replace(/export\s+const/g, 'const')
      .replace(/export\s+let/g, 'let')
      .replace(/export\s+var/g, 'var')
      .replace(/export\s+class/g, 'class')
      .replace(/export\s+default\s+/g, '');
  }

  private generateRequireStatements(imports: Array<{
    source: string;
    specifiers: Array<{ name: string; alias: string; isDefault: boolean }>;
  }>, dependencies: string[], currentFile: string): string {
    let statements = '';

    for (const imp of imports) {
      // Find the resolved dependency path for this import
      let resolvedPath = imp.source;
      if (imp.source.startsWith('./') || imp.source.startsWith('../')) {
        const originalResolved = this.resolvePath(imp.source, currentFile);
        // Find the matching dependency that was actually resolved with extension
        const matchingDep = dependencies.find(dep => dep.startsWith(originalResolved));
        if (matchingDep) {
          resolvedPath = matchingDep;
          console.log(`🔄 Transforming import: "${imp.source}" -> "${resolvedPath}"`);
        }
      }
      
      const moduleVar = `_${resolvedPath.replace(/[^a-zA-Z0-9]/g, '_')}_module`;
      statements += `  const ${moduleVar} = require('${resolvedPath}');\n`;

      for (const spec of imp.specifiers) {
        if (spec.isDefault) {
          statements += `  const ${spec.alias} = ${moduleVar}.default || ${moduleVar};\n`;
        } else if (spec.name === '*') {
          statements += `  const ${spec.alias} = ${moduleVar};\n`;
        } else {
          statements += `  const ${spec.alias} = ${moduleVar}.${spec.name};\n`;
        }
      }
    }

    return statements;
  }

  private generateExportStatements(exports: Array<{ name: string; isDefault: boolean }>, code: string): string {
    if (exports.length === 0) {
      // Try to find main function/class/const to export
      const funcMatch = code.match(/function\s+(\w+)/);
      const classMatch = code.match(/class\s+(\w+)/);
      const constMatch = code.match(/const\s+(\w+)\s*=/);
      
      const exportName = funcMatch?.[1] || classMatch?.[1] || constMatch?.[1];
      if (exportName) {
        return `  module.exports = { default: ${exportName} };`;
      }
      return '  module.exports = {};';
    }

    const exportObj: string[] = [];
    for (const exp of exports) {
      if (exp.isDefault) {
        const funcMatch = code.match(/function\s+(\w+)/);
        const classMatch = code.match(/class\s+(\w+)/);
        const constMatch = code.match(/const\s+(\w+)\s*=/);
        const exportName = funcMatch?.[1] || classMatch?.[1] || constMatch?.[1] || 'App';
        exportObj.push(`default: ${exportName}`);
      } else {
        exportObj.push(`${exp.name}: ${exp.name}`);
      }
    }

    return `  module.exports = { ${exportObj.join(', ')} };`;
  }

  private async extractDependencies(code: string, currentFile: string): Promise<string[]> {
    const dependencies: string[] = [];
    
    try {
      // Use the transpiler's parse function instead of dynamic import
      const ast = await transpiler.parseCode(code, {
        syntax: 'typescript',
        tsx: this.options.jsx
      });

      this.walkAst(ast, (node: any) => {
        if (node.type === 'ImportDeclaration') {
          const source = node.source.value;
          
          // Only process relative imports
          if (source.startsWith('./') || source.startsWith('../')) {
            const resolvedPath = this.resolvePath(source, currentFile);
            dependencies.push(resolvedPath);
          }
        }
      });

      console.log(`🔍 Found ${dependencies.length} dependencies in ${currentFile}:`, dependencies);

      // Resolve file extensions
      const resolvedDeps: string[] = [];
      for (const dep of dependencies) {
        const resolved = await this.resolveFileWithExtension(dep);
        if (resolved) {
          resolvedDeps.push(resolved);
          console.log(`✅ Resolved dependency: ${dep} -> ${resolved}`);
        } else {
          console.warn(`❌ Could not resolve dependency: ${dep}`);
        }
      }

      return resolvedDeps;
    } catch (error) {
      console.warn(`Failed to extract dependencies from ${currentFile}:`, error);
      return [];
    }
  }

  private walkAst(node: any, visitor: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;
    
    visitor(node);
    
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

  private resolvePath(relativePath: string, currentFile: string): string {
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
    
    if (relativePath.startsWith('./')) {
      return currentDir + relativePath.substring(1);
    } else if (relativePath.startsWith('../')) {
      const parts = currentDir.split('/').filter(p => p);
      const relativeParts = relativePath.split('/').filter(p => p);
      
      let upCount = 0;
      for (const part of relativeParts) {
        if (part === '..') {
          upCount++;
        } else {
          break;
        }
      }
      
      const resolvedParts = parts.slice(0, -upCount).concat(relativeParts.slice(upCount));
      return '/' + resolvedParts.join('/');
    }
    
    return relativePath;
  }

  private async resolveFileWithExtension(filePath: string): Promise<string | null> {
    if (await vfs.exists(filePath)) {
      return filePath;
    }

    const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css'];
    for (const ext of extensions) {
      const pathWithExt = filePath + ext;
      if (await vfs.exists(pathWithExt)) {
        return pathWithExt;
      }
    }

    const indexExtensions = ['/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
    for (const indexExt of indexExtensions) {
      const indexPath = filePath + indexExt;
      if (await vfs.exists(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  private isExternal(moduleId: string): boolean {
    return this.options.externals.includes(moduleId) || moduleRegistry.isExternal(moduleId);
  }

  invalidateModule(id: string) {
    this.compilationCache.delete(id);
    this.dependencyGraph.delete(id);
    
    // Invalidate dependent modules
    for (const [moduleId, deps] of Array.from(this.dependencyGraph.entries())) {
      if (deps.has(id)) {
        this.invalidateModule(moduleId);
      }
    }
  }

  clearCache() {
    this.compilationCache.clear();
    this.dependencyGraph.clear();
  }

  getDependencyGraph(): Map<string, Set<string>> {
    return new Map(this.dependencyGraph);
  }
}

export const moduleCompiler = new ModuleCompiler();