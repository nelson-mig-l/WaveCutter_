import type {NextConfig} from 'next';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'WaveCutter_';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  assetPrefix: process.env.NODE_ENV === 'production' ? `./${repoName}` : '',
  basePath: process.env.NODE_ENV === 'production' ? `./${repoName}` : '',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
