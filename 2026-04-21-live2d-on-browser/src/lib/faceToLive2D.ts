/**
 * MediaPipe FaceLandmarker の出力を Kalidokit で解析し、
 * Live2D パラメータへ変換するユーティリティ。
 */

import { Face } from "kalidokit";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface FaceSolveResult {
  eye: { l: number; r: number };
  brow: number;
  pupil: { x: number; y: number };
  head: { x: number; y: number; z: number; degrees: { x: number; y: number; z: number } };
  mouth: { x: number; y: number; shape: { A: number; E: number; I: number; O: number; U: number } };
}

// フレーム間スムージング用の前回値
export interface SmoothState {
  angleX: number; angleY: number; angleZ: number;
  eyeL: number; eyeR: number;
  pupilX: number; pupilY: number;
  browL: number; browR: number;
  mouthOpenY: number; mouthForm: number;
  bodyX: number; bodyY: number; bodyZ: number;
}

export function createSmoothState(): SmoothState {
  return {
    angleX: 0, angleY: 0, angleZ: 0,
    eyeL: 1, eyeR: 1,
    pupilX: 0, pupilY: 0,
    browL: 0, browR: 0,
    mouthOpenY: 0, mouthForm: 0,
    bodyX: 0, bodyY: 0, bodyZ: 0,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function solveFace(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number
): FaceSolveResult | null {
  try {
    const lm = landmarks as unknown as Array<{ x: number; y: number; z: number }>;
    const result = Face.solve(lm, {
      runtime: "mediapipe",
      video: null,
      imageSize: { width: videoWidth, height: videoHeight },
      smoothBlink: true,
      blinkSettings: [0.25, 0.75],
    });
    if (!result) return null;
    return result as unknown as FaceSolveResult;
  } catch {
    return null;
  }
}

export function applyFaceToModel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  face: FaceSolveResult,
  smooth: SmoothState,
  // 大きいほど追従が遅く・滑らか (0〜1)
  lerpFactor = 0.4
): void {
  if (!model || !face) return;
  const coreModel = model.internalModel?.coreModel;
  if (!coreModel) return;

  const set = (id: string, value: number) => {
    try { coreModel.setParameterValueById(id, value); } catch { /* モデル依存パラメータは無視 */ }
  };

  // lerp で前フレームと補間
  smooth.angleX   = lerp(smooth.angleX,   face.head.degrees.y, lerpFactor);
  smooth.angleY   = lerp(smooth.angleY,   face.head.degrees.x, lerpFactor);
  smooth.angleZ   = lerp(smooth.angleZ,   face.head.degrees.z, lerpFactor);
  smooth.eyeL     = lerp(smooth.eyeL,     face.eye.l,           lerpFactor);
  smooth.eyeR     = lerp(smooth.eyeR,     face.eye.r,           lerpFactor);
  smooth.pupilX   = lerp(smooth.pupilX,   face.pupil.x,         lerpFactor);
  smooth.pupilY   = lerp(smooth.pupilY,   face.pupil.y,         lerpFactor);
  smooth.browL    = lerp(smooth.browL,    face.brow,            lerpFactor);
  smooth.browR    = lerp(smooth.browR,    face.brow,            lerpFactor);
  smooth.mouthOpenY = lerp(smooth.mouthOpenY, face.mouth.y,     lerpFactor);
  smooth.mouthForm  = lerp(smooth.mouthForm,  face.mouth.x,     lerpFactor);
  smooth.bodyX    = lerp(smooth.bodyX,    smooth.angleX * 0.3,  lerpFactor);
  smooth.bodyY    = lerp(smooth.bodyY,    smooth.angleY * 0.3,  lerpFactor);
  smooth.bodyZ    = lerp(smooth.bodyZ,    smooth.angleZ * 0.3,  lerpFactor);

  set("ParamAngleX",     smooth.angleX);
  set("ParamAngleY",     smooth.angleY);
  set("ParamAngleZ",     smooth.angleZ);
  set("ParamBodyAngleX", smooth.bodyX);
  set("ParamBodyAngleY", smooth.bodyY);
  set("ParamBodyAngleZ", smooth.bodyZ);
  set("ParamEyeLOpen",   smooth.eyeL);
  set("ParamEyeROpen",   smooth.eyeR);
  set("ParamEyeBallX",   smooth.pupilX);
  set("ParamEyeBallY",   smooth.pupilY);
  set("ParamBrowLY",     smooth.browL);
  set("ParamBrowRY",     smooth.browR);
  set("ParamMouthOpenY", smooth.mouthOpenY);
  set("ParamMouthForm",  smooth.mouthForm);
}
