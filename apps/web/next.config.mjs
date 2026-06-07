/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@prm/core", "@prm/db", "@prm/integrations"],
};

export default nextConfig;
