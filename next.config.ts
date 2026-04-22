import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const repoName = "/water-margin-cyber-arena";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  basePath: isGithubPages ? repoName : undefined,
  assetPrefix: isGithubPages ? `${repoName}/` : undefined,
};

export default nextConfig;
