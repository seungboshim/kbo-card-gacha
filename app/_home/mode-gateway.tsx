"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./mode-gateway.module.css";

type Mode = "solo" | "multi";

type LeagueChoice = {
  sport: "kbo" | "epl";
  seasonId: string;
  seasonLabel: string;
  leagueLabel: string;
  live: boolean;
};

type ModeCopy = {
  kicker: string;
  title: string;
  description: string;
  compactTitle: string;
  compactDescription: string;
};

const MODE_COPY: Record<Mode, ModeCopy> = {
  solo: {
    kicker: "SOLO MODE",
    title: "혼자서",
    description: "팩을 열고 선수를 강화해 나만의 스쿼드를 완성하세요",
    compactTitle: "혼자서",
    compactDescription: "혼자만의 시즌",
  },
  multi: {
    kicker: "MULTI MODE",
    title: "여럿이서",
    description: "친구들과 카드팩을 열고, 뽑은 선수로 대결하세요",
    compactTitle: "여럿이서",
    compactDescription: "친구들과 함께",
  },
};

function ArrowIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className={direction === "left" ? styles.arrowLeft : undefined}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function BaseballField() {
  return (
    <svg aria-hidden="true" className={styles.cardArt} fill="none" viewBox="0 0 520 210">
      <g className={styles.cardArtSoft} stroke="currentColor">
        <path d="M34 143 123 96m-73 61 101-50m-84 63 113-54M486 143 397 96m73 61-101-50m84 63-113-54" />
        <path d="M142 188h236" opacity=".35" />
      </g>
      <g stroke="currentColor" strokeWidth="2">
        <path d="m260 72 82 60-82 60-82-60 82-60Z" />
        <path d="m260 91 58 42-58 42-58-42 58-42Z" opacity=".52" />
      </g>
      <g fill="currentColor">
        <path d="m255 84 5-4 5 4-5 4-5-4Z" />
        <path d="m311 132 7-5 7 5-7 5-7-5ZM195 132l7-5 7 5-7 5-7-5ZM252 174h16l-8 9-8-9Z" />
        <circle cx="260" cy="132" r="3" />
      </g>
      <path d="M218 19c45 2 92 22 132 61" stroke="currentColor" strokeDasharray="4 6" strokeWidth="2" />
      <path d="m234 23 5 6m8-3 5 7m8-3 4 7m10-2 4 7m10-1 3 7m11 0 2 7m11 1 1 7m11 2v7" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function FootballField() {
  return (
    <svg aria-hidden="true" className={styles.cardArt} fill="none" viewBox="0 0 520 210">
      <g stroke="currentColor">
        <path d="M174 102c7-51 45-85 91-85 44 0 81 31 90 78" strokeWidth="2" />
        <path d="m243 24-18 27 15 31h42l17-31-18-27m-56 27-34 10-7 35 27 24m88-69 35 11 8 34-28 24m-74-38-29 38 17 30h74l17-30-27-38m-47 0 1-31m-35 69-31 7m106-7 30 7" opacity=".72" />
      </g>
      <g className={styles.cardArtSoft} stroke="currentColor">
        <path d="M36 145 123 99m-73 59 101-51m-84 64 113-55M484 145 397 99m73 59-101-51m84 64-113-55" />
      </g>
      <g stroke="currentColor" strokeWidth="2">
        <path d="M184 188h152l-15-66H199l-15 66Z" />
        <path d="M211 188v-31h98v31m-98-20h98M227 157l-7 31m23-31-3 31m40-31 3 31m17-31 7 31" opacity=".68" />
      </g>
    </svg>
  );
}

function PanelAtmosphere() {
  return (
    <svg aria-hidden="true" className={styles.panelAtmosphere} fill="none" viewBox="0 0 1200 900" preserveAspectRatio="none">
      <g stroke="currentColor">
        <path d="M-80 891 284 735l237 92 221-88 548 152" opacity=".33" />
        <path d="m-42 854 326-140 237 91 221-88 497 137M-5 822l289-123 237 83 221-82 463 122" opacity=".18" />
        <path d="m389 851 132-50 132 50-132 49-132-49Z" opacity=".55" />
        <path d="M521 801v99m-132-49h264" opacity=".22" />
        <path d="M620-20c165 10 328 87 444 218" strokeDasharray="5 9" opacity=".42" />
        <path d="m669 4 7 10m22-4 7 11m23-3 6 11m24-1 5 12m24 1 4 12m24 3 3 12m23 5 2 12m23 7v13" opacity=".65" />
      </g>
    </svg>
  );
}

function LeagueCard({ league, mode, active }: { league: LeagueChoice; mode: Mode; active: boolean }) {
  const title = `${league.seasonLabel} ${league.leagueLabel}`;

  return (
    <Link
      aria-label={`${title}${league.live ? " 라이브" : ""} ${MODE_COPY[mode].title} 바로 시작`}
      className={styles.leagueCard}
      data-sport={league.sport}
      href={`/${league.sport}/${mode}/${league.seasonId}`}
      tabIndex={active ? 0 : -1}
    >
      <span className={styles.cardCopy}>
        <span className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>{title}</span>
          {league.live && <span className={styles.liveBadge}>LIVE</span>}
        </span>
        <span className={styles.cardAction}>
          바로 시작
          <ArrowIcon />
        </span>
      </span>
      {league.sport === "kbo" ? <BaseballField /> : <FootballField />}
    </Link>
  );
}

function ActiveModeContent({ mode, leagues, active }: { mode: Mode; leagues: LeagueChoice[]; active: boolean }) {
  const copy = MODE_COPY[mode];

  return (
    <div aria-hidden={!active} className={styles.activeContent}>
      <div className={styles.heroCopy}>
        <p className={styles.modeKicker}>{copy.kicker}</p>
        <h1 className={styles.modeTitle}>{copy.title}</h1>
        <p className={styles.modeDescription}>{copy.description}</p>
      </div>

      <nav aria-label={`${copy.title} 리그 선택`} className={styles.leagueList}>
        {leagues.map((league) => (
          <LeagueCard active={active} key={league.sport} league={league} mode={mode} />
        ))}
      </nav>
    </div>
  );
}

function ModePanel({
  mode,
  currentMode,
  leagues,
}: {
  mode: Mode;
  currentMode: Mode;
  leagues: LeagueChoice[];
}) {
  const active = mode === currentMode;
  const copy = MODE_COPY[mode];

  return (
    <section
      aria-label={`${copy.title} 모드`}
      className={[styles.panel, mode === "solo" ? styles.soloPanel : styles.multiPanel].join(" ")}
      data-active={active}
    >
      <PanelAtmosphere />
      <ActiveModeContent active={active} leagues={leagues} mode={mode} />
    </section>
  );
}

function ModeSwitch({ mode, onSelect }: { mode: Mode; onSelect: (mode: Mode) => void }) {
  const copy = MODE_COPY[mode];

  return (
    <button
      aria-label={`${copy.title} 모드 선택`}
      className={styles.switchButton}
      data-side={mode}
      onClick={() => onSelect(mode)}
      type="button"
    >
      <span className={styles.compactCopy}>
        <span className={styles.compactKicker}>{copy.kicker}</span>
        <span className={styles.compactTitle}>{copy.compactTitle}</span>
        <span className={styles.compactDescription}>{copy.compactDescription}</span>
        <span className={styles.switchArrow}>
          <ArrowIcon direction={mode === "solo" ? "left" : "right"} />
        </span>
      </span>
    </button>
  );
}

export function ModeGateway({ leagues }: { leagues: LeagueChoice[] }) {
  const [mode, setMode] = useState<Mode>("solo");

  return (
    <main className={styles.gateway} data-mode={mode}>
      <header className={styles.brand}>
        <span className={styles.brandName}>squad gacha</span>
        <span aria-hidden="true" className={styles.brandRule} />
        <span className={styles.brandMeta}>KBO · EPL</span>
      </header>

      <ModePanel currentMode={mode} leagues={leagues} mode="solo" />
      <ModePanel currentMode={mode} leagues={leagues} mode="multi" />

      <span aria-hidden="true" className={styles.divider} />
      <ModeSwitch mode={mode === "solo" ? "multi" : "solo"} onSelect={setMode} />
      <p aria-live="polite" className={styles.srOnly}>
        {MODE_COPY[mode].title} 모드가 선택되었습니다.
      </p>
    </main>
  );
}
