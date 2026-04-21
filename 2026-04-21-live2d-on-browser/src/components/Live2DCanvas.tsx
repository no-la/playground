"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import type { FaceSolveResult, SmoothState } from "@/lib/faceToLive2D";
import { applyFaceToModel, createSmoothState } from "@/lib/faceToLive2D";

// Live2D 公式サンプルモデル (CubismWebSamples / Haru)
const DEFAULT_MODEL_URL =
  "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@develop/Samples/Resources/Haru/Haru.model3.json";

export interface Live2DCanvasHandle {
  applyFace: (face: FaceSolveResult) => void;
}

interface Live2DCanvasProps {
  modelUrl?: string;
  className?: string;
}

const Live2DCanvas = forwardRef<Live2DCanvasHandle, Live2DCanvasProps>(
  ({ modelUrl = DEFAULT_MODEL_URL, className }, ref) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appRef = useRef<any>(null);
    const smoothRef = useRef<SmoothState>(createSmoothState());

    useImperativeHandle(ref, () => ({
      applyFace: (face: FaceSolveResult) => {
        if (modelRef.current) {
          applyFaceToModel(modelRef.current, face, smoothRef.current);
        }
      },
    }));

    useEffect(() => {
      if (!canvasRef.current) return;

      let cancelled = false;
      const container = canvasRef.current;

      async function init() {
        // pixi.js / pixi-live2d-display は browser-only → 動的インポート
        const { Application, Ticker } = await import("pixi.js");
        const { Live2DModel } = await import("pixi-live2d-display/cubism4");

        // pixi-live2d-display にアニメーション用 Ticker を登録
        Live2DModel.registerTicker(Ticker);

        if (cancelled) return;

        const width = container.clientWidth || 480;
        const height = container.clientHeight || 640;

        // pixi に canvas を自動生成させてから DOM に追加する
        const app = new Application({
          width,
          height,
          transparent: true, // pixi.js v6: 透明背景
          antialias: true,
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        appRef.current = app;
        container.appendChild(app.view as HTMLCanvasElement);

        // Live2D モデルを読み込む
        const model = await Live2DModel.from(modelUrl, { autoInteract: false });

        if (cancelled) {
          model.destroy();
          app.destroy(true);
          return;
        }

        modelRef.current = model;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.stage.addChild(model as any);

        // モデルをキャンバス中央に収まるようにスケール調整
        const scale = Math.min(width / model.width, height / model.height) * 0.9;
        model.scale.set(scale);
        model.x = (width - model.width * scale) / 2;
        model.y = (height - model.height * scale) / 2;
      }

      init().catch(console.error);

      return () => {
        cancelled = true;
        if (modelRef.current) {
          modelRef.current.destroy();
          modelRef.current = null;
        }
        if (appRef.current) {
          // destroy(true) で canvas も含めて破棄
          appRef.current.destroy(true, { children: true });
          appRef.current = null;
        }
      };
    }, [modelUrl]);

    return <div ref={canvasRef} className={className} />;
  }
);

Live2DCanvas.displayName = "Live2DCanvas";
export default Live2DCanvas;
