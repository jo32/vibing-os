/** @type {import('next').NextConfig} */
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const nextConfig = {
  transpilePackages: ['@zenfs/core', '@zenfs/dom'],
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config, { isServer }) => {
    // Handle WebAssembly files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add Monaco Editor plugin for client-side only
    if (!isServer) {
      config.plugins.push(
        new MonacoWebpackPlugin({
          languages: ['typescript', 'javascript', 'html', 'css', 'json'],
          features: ['!gotoSymbol']
        })
      );
    }

    // Handle WASM modules for @swc/wasm-web
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/wasm/[hash][ext][query]',
      },
    });

    // Resolve node modules for browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      buffer: false,
      util: false,
    };

    // Handle @swc/wasm-web and ZenFS specific issues
    config.resolve.alias = {
      ...config.resolve.alias,
      '@swc/wasm-web': require.resolve('@swc/wasm-web'),
    };

    // Disable module concatenation for ZenFS to fix export issues
    config.optimization = {
      ...config.optimization,
      concatenateModules: false,
    };




    return config;
  },
  // Allow loading external resources from esm.run
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;