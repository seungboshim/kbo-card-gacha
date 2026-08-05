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
  // 옛 주소를 새 경로로 넘긴다. 리다이렉트는 파일시스템보다 먼저 검사된다.
  // 308(영구)이 아니라 307(임시)인 이유는, 나중에 /kbo 를 종목 홈으로 쓰고 싶어질 때
  // 브라우저 캐시에 박혀 있으면 되돌리기 어렵기 때문이다.
  async redirects() {
    return [
      { source: "/kbo", destination: "/kbo/multi", permanent: false },
      { source: "/epl", destination: "/epl/multi", permanent: false },
    ];
  },
};

export default nextConfig;
