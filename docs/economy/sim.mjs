// 새 경제안 검산 + 몬테카를로
const BASE = { C: 20, U: 80, R: 250, E: 800, L: 3000 };
const ORD = { C: 0, U: 1, R: 2, E: 3, L: 4 };
const MULT = [1.08,1.10,1.12,1.14,1.16,1.18,1.22,1.26,1.30,1.35,1.40,1.45,1.50,1.55,1.60];
const CUM = [1]; MULT.forEach(m => CUM.push(CUM.at(-1) * m));
const SUCC = [95,90,85,80,75,70,60,50,42,35,28,22,16,10,5];
const DEST = [0,0,0,0,0,0,4,8,12,16,22,30,38,46,55];
const FEE_RATE = 0.12;
const PACKS = {
  normal:   { price: 500,  n: 3, odds: [['L',1],['E',6],['R',20],['U',34],['C',39]], buyAt: 500 },
  premium:  { price: 1400, n: 5, odds: [['L',2],['E',13],['R',30],['U',40],['C',15]], buyAt: 1900 },
  platinum: { price: 2800, n: 5, odds: [['L',8],['E',24],['R',43],['U',25]], buyAt: 3200 },
};
const val = (t, l) => Math.floor(BASE[t] * CUM[l]);
const fee = (t, l) => Math.max(1, Math.ceil(val(t, Math.min(l, 6)) * FEE_RATE));

// ---------- 검산 출력 ----------
console.log('=== 누적곱 CUM ===');
console.log(CUM.map((c, i) => `+${i}: ${c.toFixed(4)}`).join('  '));
console.log('\n=== 가치표 (+0/+5/+8/+10/+15) ===');
for (const t of ['C','U','R','E','L'])
  console.log(t, [0,5,8,10,15].map(l => val(t,l)).join(' / '));
console.log('\n=== 단계별 기대손익 (%) = p성공*(배수-1) - p파괴 - 12 ===');
for (let k = 0; k < 15; k++) {
  const feePct = FEE_RATE * CUM[Math.min(k,6)] / CUM[k];
  const ev = SUCC[k]/100*(MULT[k]-1) - DEST[k]/100 - feePct;
  console.log(`+${k}→+${k+1}: 성공 ${SUCC[k]}%, 파괴 ${DEST[k]}%, 배수 ${MULT[k]}, 수수료 ${(feePct*100).toFixed(1)}%, EV ${(ev*100).toFixed(1)}%`);
}
console.log('\n=== +0→+k 올려 팔기 누적 EV (기본가 대비) ===');
let cumFee = 0;
for (let k = 0; k < 6; k++) {
  cumFee += FEE_RATE * CUM[k] / (SUCC[k]/100);
  const net = (CUM[k+1] - 1) - cumFee;
  console.log(`+${k+1}에서 팔기: 이득 ${((CUM[k+1]-1)*100).toFixed(1)}%, 수수료 ${(cumFee*100).toFixed(1)}%, 순 ${(net*100).toFixed(1)}%`);
}
console.log('\n=== 팩 EV ===');
for (const [name, P] of Object.entries(PACKS)) {
  const evCard = P.odds.reduce((s, [t, p]) => s + p/100 * BASE[t], 0);
  const ev = evCard * P.n;
  console.log(`${name}: ${P.price} → EV ${ev.toFixed(1)}, 엣지 ${((1 - ev/P.price)*100).toFixed(1)}%`);
}
console.log('\n=== +6에서 +k까지 생존 확률 (자금 무한 가정) ===');
let surv = 1;
for (let k = 6; k < 15; k++) {
  surv *= SUCC[k] / (SUCC[k] + DEST[k]);
  console.log(`+${k+1} 도달: ${(surv*100).toFixed(4)}%  (1/${Math.round(1/surv)})`);
}
console.log('\n=== 보호료 (가치 대비 %, = 파괴율×1.3) ===');
for (let k = 6; k < 15; k++) console.log(`+${k}→+${k+1}: ${(DEST[k]*1.3).toFixed(1)}%`);

// ---------- 몬테카를로 ----------
function draw(odds) {
  let r = Math.random() * 100;
  for (const [t, p] of odds) { if (r < p) return t; r -= p; }
  return odds.at(-1)[0];
}

function simRun() {
  let credits = 2000, project = null;
  let rolls = 0, sells = 0, buys = 0;
  let maxLv = 0, peakVal = 0, legend15 = false, any15 = false;
  let firstPlat = null, destroys = 0, committed = 0, legendsCommitted = 0, legendMax = -1, feePaid = 0, destroyLoss = 0;
  while (true) {
    while (project) {
      const v = val(project.t, project.lv);
      if (project.lv === 15) {
        credits += v; sells++;
        if (project.t === 'L') legend15 = true;
        any15 = true; project = null; break;
      }
      // 은행 규칙: 도박 구간의 비레전드는 현금+카드값이 플래티넘 진입선을 넘으면 판다
      if (project.t !== 'L' && project.lv >= 6 && credits + v >= PACKS.platinum.buyAt) { credits += v; sells++; project = null; break; }
      const f = fee(project.t, project.lv);
      if (credits < f + 500) { credits += v; sells++; project = null; break; } // 예비금 500 깨지면 판다
      credits -= f; rolls++; feePaid += f;
      const r = Math.random() * 100;
      if (r < SUCC[project.lv]) {
        project.lv++;
        if (project.lv > maxLv) maxLv = project.lv;
        if (project.t === 'L' && project.lv > legendMax) legendMax = project.lv;
        const nv = val(project.t, project.lv);
        if (nv > peakVal) peakVal = nv;
      } else if (r < SUCC[project.lv] + DEST[project.lv]) { destroyLoss += v; project = null; destroys++; }
    }
    let pk = null;
    if (credits >= PACKS.platinum.buyAt) pk = 'platinum';
    else if (credits >= PACKS.premium.buyAt) pk = 'premium';
    else if (credits >= PACKS.normal.price) pk = 'normal';
    if (!pk) break; // 파산
    const P = PACKS[pk];
    credits -= P.price; buys++;
    if (pk === 'platinum' && firstPlat === null) firstPlat = { buys, rolls, sells, min: (rolls*1.5 + sells*0.8 + buys*6)/60 };
    const cards = [];
    for (let i = 0; i < P.n; i++) {
      const t = draw(P.odds); cards.push(t);
      if (BASE[t] > peakVal) peakVal = BASE[t];
    }
    cards.sort((a, b) => ORD[b] - ORD[a]);
    if (ORD[cards[0]] >= 2) { // 레어 이상만 프로젝트로 잡는다
      project = { t: cards[0], lv: 0 }; committed++;
      if (cards[0] === 'L') { legendsCommitted++; if (legendMax < 0) legendMax = 0; }
      for (let i = 1; i < cards.length; i++) { credits += BASE[cards[i]]; sells++; }
    } else {
      for (const c of cards) { credits += BASE[c]; sells++; }
    }
    if (buys + rolls + sells > 200000) break;
  }
  return { rolls, sells, buys, maxLv, peakVal, legend15, any15, firstPlat, destroys, committed, legendsCommitted, legendMax, feePaid, destroyLoss };
}

const N = 1000000;
const agg = [];
for (let i = 0; i < N; i++) agg.push(simRun());

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

const buysA = agg.map(r => r.buys), rollsA = agg.map(r => r.rolls), sellsA = agg.map(r => r.sells);
const maxLvA = agg.map(r => r.maxLv), peakA = agg.map(r => r.peakVal);
const minutesA = agg.map(r => (r.rolls * 1.5 + r.sells * 0.8 + r.buys * 6) / 60);

console.log(`\n=== 몬테카를로 (${N}판, 봇: 레어+ 프로젝트, 2800 되면 은행, 레전드는 끝까지) ===`);
console.log(`팩 구매: 중앙값 ${pct(buysA, .5)}, 평균 ${mean(buysA).toFixed(1)}, p90 ${pct(buysA, .9)}`);
console.log(`강화 클릭: 중앙값 ${pct(rollsA, .5)}, 평균 ${mean(rollsA).toFixed(1)}, p90 ${pct(rollsA, .9)}`);
console.log(`판매 클릭: 중앙값 ${pct(sellsA, .5)}, 평균 ${mean(sellsA).toFixed(1)}`);
console.log(`판 길이(분, 강화1.5s/판매0.8s/팩6s): 중앙값 ${pct(minutesA, .5).toFixed(1)}, 평균 ${mean(minutesA).toFixed(1)}, p90 ${pct(minutesA, .9).toFixed(1)}`);
console.log(`최고 강화: 중앙값 +${pct(maxLvA, .5)}, p90 +${pct(maxLvA, .9)}, p99 +${pct(maxLvA, .99)}`);
console.log(`최고 카드 가치: 중앙값 ${pct(peakA, .5)}, p90 ${pct(peakA, .9)}, p99 ${pct(peakA, .99)}`);
console.log(`+15 도달(아무 카드): ${(agg.filter(r => r.any15).length / N * 100).toFixed(3)}%`);
console.log(`레전드 +15: ${(agg.filter(r => r.legend15).length / N * 100).toFixed(4)}%  (${agg.filter(r => r.legend15).length}건)`);
const plat = agg.filter(r => r.firstPlat);
console.log(`플래티넘 도달률: ${(plat.length / N * 100).toFixed(1)}%`);
console.log(`첫 플래티넘까지: 구매 중앙값 ${pct(plat.map(r => r.firstPlat.buys), .5)}, 강화클릭 중앙값 ${pct(plat.map(r => r.firstPlat.rolls), .5)}, p90 강화클릭 ${pct(plat.map(r => r.firstPlat.rolls), .9)}, 시간 중앙값 ${pct(plat.map(r => r.firstPlat.min), .5).toFixed(1)}분`);
console.log(`가우틀릿 투입 카드 수: 평균 ${mean(agg.map(r => r.committed)).toFixed(1)}, 파괴 평균 ${mean(agg.map(r => r.destroys)).toFixed(1)}`);
console.log(`레전드 프로젝트 수: 평균 ${mean(agg.map(r => r.legendsCommitted)).toFixed(2)}`);
const withLegend = agg.filter(r => r.legendMax >= 0);
console.log(`레전드 보유 판 비율: ${(withLegend.length/N*100).toFixed(1)}%, 그 판들의 레전드 최고 강화: 중앙값 +${pct(withLegend.map(r=>r.legendMax),.5)}, p90 +${pct(withLegend.map(r=>r.legendMax),.9)}`);
console.log(`돈 흐름: 수수료 평균 ${mean(agg.map(r=>r.feePaid)).toFixed(0)}, 파괴 손실 평균 ${mean(agg.map(r=>r.destroyLoss)).toFixed(0)}`);
console.log(`+12 이상 도달: ${(agg.filter(r=>r.maxLv>=12).length/N*100).toFixed(2)}%, +13 이상: ${(agg.filter(r=>r.maxLv>=13).length/N*100).toFixed(2)}%`);
