/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // For Node.js backend
    if (isServer) {
      // Mark certain packages as external to prevent webpack from processing them
      config.externals = [...config.externals, 'libsql', '@libsql/client', '@libsql/hrana-client'];
    }

    // Add resolve fallbacks for node.js modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Ignore non-JavaScript files in node_modules
    config.module.rules.push({
      test: /\.(md|LICENSE|txt)$/,
      include: [/node_modules\/@libsql/, /node_modules\/libsql/],
      use: 'null-loader',
    });

    // Handle sharp modules
    config.resolve.alias = {
      ...config.resolve.alias,
      '@img/sharp-libvips-dev/include': false,
      '@img/sharp-libvips-dev/cplusplus': false,
      '@img/sharp-wasm32/versions': false,
    };

    return config;
  },
};

export default nextConfig;
