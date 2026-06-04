import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

export interface ActorDef {
  id: string;
  icon: string;
  name: string;
  sub?: string;
}

export interface PlayerStep {
  /** このステップでハイライトする登場人物のid。 */
  actor: string;
  /** データの流れ（任意）: from→to のアクター間で矢印を出す。 */
  from?: string;
  to?: string;
  arrowLabel?: string;
  title: string;
  description: ReactNode;
  /** 折りたたみで見せる実データ（任意）。 */
  detail?: ReactNode;
  /** このステップが本物の処理（例: OS認証）を伴うか。表示の注意喚起に使う。 */
  live?: boolean;
}

interface StepPlayerProps {
  steps: PlayerStep[];
  actors: ActorDef[];
  /** ステップに入った時に一度だけ実行する副作用（本物のWebAuthn等）。例外は捕捉して表示。 */
  onActivate?: (index: number) => Promise<void> | void;
  /** 「最初から」で呼ばれる。親の状態リセット用。 */
  onReset?: () => void;
  /** 例外を日本語化する関数（任意）。 */
  formatError?: (e: unknown) => string;
  autoPlayMs?: number;
}

export function StepPlayer({
  steps,
  actors,
  onActivate,
  onReset,
  formatError = (e) => (e instanceof Error ? e.message : String(e)),
  autoPlayMs = 2600,
}: StepPlayerProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activated = useRef<Set<number>>(new Set());
  // 最新の onActivate を保持して stale closure を避ける。
  const activateRef = useRef(onActivate);
  activateRef.current = onActivate;

  const last = steps.length - 1;
  const step = steps[index];

  async function goTo(target: number, opts?: { auto?: boolean }) {
    if (busy) return;
    const clamped = Math.max(0, Math.min(last, target));
    if (!opts?.auto) setPlaying(false);
    setError(null);
    setIndex(clamped);

    if (activateRef.current && !activated.current.has(clamped)) {
      setBusy(true);
      try {
        await activateRef.current(clamped);
        activated.current.add(clamped);
      } catch (e) {
        setError(formatError(e));
        setPlaying(false);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
  }

  // 初回マウント時に step0 の副作用（チャレンジ生成など）を実行。
  useEffect(() => {
    void goTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自動再生。busy中・最終ステップでは進めない。
  useEffect(() => {
    if (!playing || busy) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => void goTo(index + 1, { auto: true }), autoPlayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, busy, index, last]);

  function reset() {
    setPlaying(false);
    setError(null);
    activated.current.clear();
    onReset?.();
    setIndex(0);
    void goTo(0);
  }

  const activeIds = new Set([step.actor, step.from, step.to].filter(Boolean) as string[]);

  return (
    <div className="space-y-4">
      {/* 進捗ドット */}
      <div className="flex items-center gap-2">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`ステップ ${i + 1}`}
            className="group flex-1"
          >
            <div
              className={`h-1.5 rounded-full transition-all ${
                i < index
                  ? "bg-emerald-400/70"
                  : i === index
                    ? "bg-sky-400"
                    : "bg-white/10 group-hover:bg-white/20"
              }`}
            />
          </button>
        ))}
        <span className="ml-2 shrink-0 text-xs font-semibold text-slate-400">
          {index + 1} / {steps.length}
        </span>
      </div>

      {/* ステージ：登場人物 */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-stretch justify-between gap-2">
          {actors.map((a) => (
            <motion.div
              key={a.id}
              animate={{
                scale: activeIds.has(a.id) ? 1.06 : 1,
                opacity: activeIds.has(a.id) ? 1 : 0.5,
              }}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center ${
                activeIds.has(a.id)
                  ? "border-sky-400/60 bg-sky-400/10 shadow-lg shadow-sky-500/20"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="text-[11px] font-semibold text-slate-100">{a.name}</span>
              {a.sub && <span className="text-[9px] text-slate-400">{a.sub}</span>}
            </motion.div>
          ))}
        </div>

        {/* データの流れ */}
        <div className="mt-3 h-6">
          <AnimatePresence mode="wait">
            {step.from && step.to && (
              <motion.div
                key={`${index}-flow`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative flex items-center justify-center gap-2 text-xs text-slate-300"
              >
                <span>{iconOf(actors, step.from)}</span>
                <div className="relative h-px w-24 bg-gradient-to-r from-sky-400/30 to-violet-400/60">
                  <motion.span
                    initial={{ left: "-8%" }}
                    animate={{ left: "100%" }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-2 text-sm"
                  >
                    {busy && step.live ? "⏳" : "✉️"}
                  </motion.span>
                </div>
                <span>{iconOf(actors, step.to)}</span>
                {step.arrowLabel && (
                  <span className="ml-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                    {step.arrowLabel}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* いま起きていること */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">💡</span>
            <h3 className="text-base font-bold text-white">{step.title}</h3>
            {step.live && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-400/30">
                本物の認証
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{step.description}</p>

          {busy && (
            <div className="mt-3 flex items-center gap-2 text-sm text-sky-300">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
              処理中… {step.live && "（端末の認証画面で本人確認してください）"}
            </div>
          )}

          {error && (
            <div className="mt-3 space-y-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-400/30">
              <div>{error}</div>
              <button onClick={() => goTo(index)} className="btn-ghost !py-1.5 text-xs">
                もう一度
              </button>
            </div>
          )}

          {step.detail && !busy && <DetailDisclosure>{step.detail}</DetailDisclosure>}
        </motion.div>
      </AnimatePresence>

      {/* 操作バー */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button onClick={reset} disabled={busy} className="btn-ghost !px-3">
          ⏮ 最初から
        </button>
        <button onClick={() => goTo(index - 1)} disabled={busy || index === 0} className="btn-ghost">
          ← 戻る
        </button>
        <button
          onClick={() => goTo(index + 1)}
          disabled={busy || index === last}
          className="btn-primary min-w-[120px]"
        >
          {index === last ? "完了 🎉" : "次へ →"}
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={busy || index === last}
          className="btn-ghost"
        >
          {playing ? "⏸ 一時停止" : "▶ 自動再生"}
        </button>
      </div>
    </div>
  );
}

function DetailDisclosure({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-semibold text-sky-300 hover:underline"
      >
        {open ? "▾ 詳細データを隠す" : "▸ 詳細データを見る"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function iconOf(actors: ActorDef[], id: string): string {
  return actors.find((a) => a.id === id)?.icon ?? "•";
}
