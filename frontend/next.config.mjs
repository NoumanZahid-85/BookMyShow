// Docker sets API_PROXY_URL to the nginx service; local dev uses nginx on localhost.
const apiProxy = process.env.API_PROXY_URL ?? "http://localhost:8080";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // small Docker image; no effect on `next dev`
  reactStrictMode: false, // Prevents duplicate WebSocket handshakes in dev mode
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxy}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
