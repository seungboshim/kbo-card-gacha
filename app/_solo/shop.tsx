"use client";

import { PACKS, type Pack } from "./economy";

export function Shop({ credits, onBuy }: { credits: number; onBuy: (pack: Pack) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold tracking-wide text-zinc-500 uppercase">상점</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {PACKS.map((p) => {
          const afford = credits >= p.price;
          return (
            <button
              key={p.key}
              type="button"
              disabled={!afford}
              onClick={() => onBuy(p)}
              className="flex flex-col gap-1 rounded-2xl bg-white/5 px-4 py-4 text-left ring-1 ring-white/10 transition-colors outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">{p.name}</span>
                <span className="text-sm font-black text-amber-300 tabular-nums">{p.price.toLocaleString()}</span>
              </div>
              <span className="text-xs text-zinc-400">{p.blurb}</span>
              <span className="text-[11px] text-zinc-600">{p.size}장</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
