import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // pstatic.net은 브라우저에서 직접 불러오면 막힌다(ERR_BLOCKED_BY_ORB). 서버에서 받아 다시 내보낸다. KBO 카드용.
      { protocol: "https", hostname: "sports-phinf.pstatic.net", pathname: "/**" },
      // EPL 카드의 선수 사진과 팀 로고.
      { protocol: "https", hostname: "images.fotmob.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
