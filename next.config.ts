import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // pstatic.net은 브라우저에서 직접 불러오면 막힌다(ERR_BLOCKED_BY_ORB). 서버에서 받아 다시 내보낸다.
    remotePatterns: [{ protocol: "https", hostname: "sports-phinf.pstatic.net", pathname: "/**" }],
  },
};

export default nextConfig;
