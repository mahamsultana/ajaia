/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // mammoth and pg are server-only Node packages; keep them out of the bundle.
    serverComponentsExternalPackages: ["mammoth", "pg"],
  },
};
export default nextConfig;
