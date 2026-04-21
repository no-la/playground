"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { Live2DCanvasHandle } from "@/components/Live2DCanvas";

// pixi.js / pixi-live2d-display は browser-only → SSR 無効で動的インポート
const Live2DCanvas = dynamic(() => import("@/components/Live2DCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-zinc-400">
      モデル読み込み中...
    </div>
  ),
});

const FaceTracker = dynamic(() => import("@/components/FaceTracker"), {
  ssr: false,
});

type TrackingState = "idle" | "loading" | "running" | "error";

const STATE_LABELS: Record<TrackingState, string> = {
  idle: "待機中",
  loading: "初期化中...",
  running: "トラッキング中",
  error: "エラー",
};

const STATE_COLORS: Record<TrackingState, string> = {
  idle: "bg-zinc-400",
  loading: "bg-yellow-400 animate-pulse",
  running: "bg-green-500",
  error: "bg-red-500",
};

export default function Home() {
  const live2dRef = useRef<Live2DCanvasHandle>(null);
  const [state, setState] = useState<TrackingState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-zinc-900 text-white overflow-hidden">
      {/* 左パネル: Live2D キャンバス */}
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <h1 className="mb-3 text-xl font-semibold tracking-wide">
          Live2D Face Tracker
        </h1>

        {/* ステータスバッジ */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${STATE_COLORS[state]}`}
          />
          <span className="text-zinc-300">{STATE_LABELS[state]}</span>
        </div>

        {/* Live2D キャンバス領域 */}
        <div className="relative h-[540px] w-[400px] rounded-2xl overflow-hidden bg-gradient-to-b from-indigo-950 to-zinc-900 shadow-2xl border border-white/10">
          <Live2DCanvas
            ref={live2dRef}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* 右パネル: カメラプレビュー & コントロール */}
      <div className="flex w-72 flex-col gap-4 border-l border-white/10 bg-zinc-800 p-4">
        <h2 className="text-base font-medium text-zinc-300">カメラ</h2>

        <FaceTracker
          live2dRef={live2dRef}
          onStateChange={setState}
          onError={(msg) => {
            setErrorMsg(msg);
            setState("error");
          }}
        />

        {errorMsg && (
          <div className="rounded-lg bg-red-900/50 border border-red-500/30 px-3 py-2 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        <div className="mt-auto rounded-lg bg-zinc-700/50 p-3 text-xs text-zinc-400 leading-relaxed">
          <p className="font-medium text-zinc-300 mb-1">使い方</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>「カメラを開始」をクリック</li>
            <li>カメラアクセスを許可する</li>
            <li>画面に顔を向ける</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
