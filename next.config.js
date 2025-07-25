/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable server components by default
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  // Optimize for production
  poweredByHeader: false,
  // Enable strict mode for better development experience
  reactStrictMode: true,
  // Optimize images
  images: {
    domains: ['secure.gravatar.com', 'avatars.slack-edge.com'],
  },
  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.DATABASE_URL,
  },
}

module.exports = nextConfig 