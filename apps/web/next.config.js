/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'replicate.com', 'picsum.photos'],
  },
  output: 'standalone',
  // Fix CSP issues in development
  experimental: {
    esmExternals: false,
  },
  // Disable CSP for development
      async headers() {
        return [
          {
            source: '/(.*)',
            headers: [
              {
                key: 'Content-Security-Policy',
                value: "default-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob: https: http:; img-src 'self' data: blob: https: http:; script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http:; style-src 'self' 'unsafe-inline' https: http:; connect-src 'self' https: http: localhost:* blob:;",
              },
            ],
          },
        ]
      },
}

module.exports = nextConfig
