/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
    ];
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: `${backendUrl}/admin/`,
        permanent: false,
      },
      {
        source: "/admin/:path*",
        destination: `${backendUrl}/admin/:path*`,
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
