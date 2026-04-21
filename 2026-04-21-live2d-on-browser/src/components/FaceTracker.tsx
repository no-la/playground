"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCamera } from "@/hooks/useCamera";
import type { Live2DCanvasHandle } from "./Live2DCanvas";
import { solveFace } from "@/lib/faceToLive2D";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

// MediaPipe wasm のアセットパス (CDN)
const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

interface FaceTrackerProps {
  live2dRef: React.RefObject<Live2DCanvasHandle | null>;
  onStateChange?: (state: "idle" | "loading" | "running" | "error") => void;
  onError?: (msg: string) => void;
}

export default function FaceTracker({
  live2dRef,
  onStateChange,
  onError,
}: FaceTrackerProps) {
  const { videoRef, isReady, error, startCamera, stopCamera } = useCamera();
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(-1);

  // MediaPipe FaceLandmarker を初期化
  const initLandmarker = useCallback(async () => {
    const { FaceLandmarker, FilesetResolver } = await import(
      "@mediapipe/tasks-vision"
    );

    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    const landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });

    landmarkerRef.current = landmarker;
  }, []);

  // フレームごとの顔検出ループ
  const detectLoop = useCallback(
    (nowMs: number) => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      // 同じフレームを二重処理しない
      if (nowMs !== lastTimeRef.current) {
        lastTimeRef.current = nowMs;

        const result = landmarker.detectForVideo(video, nowMs);

        if (result.faceLandmarks.length > 0) {
          const landmarks = result.faceLandmarks[0];
          const face = solveFace(landmarks, video.videoWidth, video.videoHeight);

          if (face && live2dRef.current) {
            live2dRef.current.applyFace(face);
          }
        }
      }

      rafRef.current = requestAnimationFrame(detectLoop);
    },
    [videoRef, live2dRef]
  );

  // 起動
  const start = useCallback(async () => {
    onStateChange?.("loading");
    try {
      await initLandmarker();
      await startCamera();
      onStateChange?.("running");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "初期化に失敗しました";
      onError?.(msg);
      onStateChange?.("error");
    }
  }, [initLandmarker, startCamera, onStateChange, onError]);

  // カメラ準備完了後にループ開始
  useEffect(() => {
    if (isReady && landmarkerRef.current) {
      rafRef.current = requestAnimationFrame(detectLoop);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isReady, detectLoop]);

  // アンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      stopCamera();
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [stopCamera]);

  // カメラエラーを親へ伝搬
  useEffect(() => {
    if (error) {
      onError?.(error);
      onStateChange?.("error");
    }
  }, [error, onError, onStateChange]);

  return (
    <div className="relative">
      {/* プレビュー映像（左右反転） */}
      <video
        ref={videoRef}
        className="w-full rounded-lg mirror"
        style={{ transform: "scaleX(-1)" }}
        muted
        playsInline
      />
      <button
        onClick={start}
        className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
      >
        カメラを開始
      </button>
    </div>
  );
}
