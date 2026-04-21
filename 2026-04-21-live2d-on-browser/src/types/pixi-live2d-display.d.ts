/**
 * pixi-live2d-display の最低限の型宣言。
 * パッケージ自体に型定義が含まれている場合はこのファイルは無視される。
 */
declare module "pixi-live2d-display/cubism4" {
  export interface Live2DModelOptions {
    autoInteract?: boolean;
  }

  export interface InternalModel {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coreModel: any;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class Live2DModel extends (null as any) {
    static from(
      source: string,
      options?: Live2DModelOptions
    ): Promise<Live2DModel>;

    width: number;
    height: number;
    internalModel: InternalModel;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scale: any;
    x: number;
    y: number;

    destroy(): void;
  }
}
