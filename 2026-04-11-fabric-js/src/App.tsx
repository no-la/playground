import React, { useEffect, useRef } from 'react';
import * as fabric from 'fabric';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. キャンバスの初期化（ウィンドウサイズ一杯に広げる）
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#1a1a1a', // PureRef風のダーク背景
      selection: true,            // 複数選択を許可
    });

    // 2. ズーム機能 (マウスホイール)
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.01) zoom = 0.01;
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // 3. パン（画面移動）機能: 右クリックドラッグ
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e;
      // 右クリック(button === 2)でパン開始
      if (evt.button === 2) {
        canvas.isDragging = true;
        canvas.selection = false; // パン中は範囲選択をオフに
        canvas.lastPosX = evt.clientX;
        canvas.lastPosY = evt.clientY;
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (canvas.isDragging) {
        const e = opt.e;
        const vpt = canvas.viewportTransform;
        vpt[4] += e.clientX - canvas.lastPosX;
        vpt[5] += e.clientY - canvas.lastPosY;
        canvas.requestRenderAll();
        canvas.lastPosX = e.clientX;
        canvas.lastPosY = e.clientY;
      }
    });

    canvas.on('mouse:up', () => {
      canvas.setViewportTransform(canvas.viewportTransform);
      canvas.isDragging = false;
      canvas.selection = true;
    });

    // コンテキストメニュー（右クリックメニュー）を無効化してパンしやすくする
    canvas.upperCanvasEl.oncontextmenu = (e) => e.preventDefault();

    fabricCanvasRef.current = canvas;

    return () => {
      canvas.dispose();
    };
  }, []);

  // 4. 画像のドロップ処理
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (f) => {
          const data = f.target?.result as string;
          const img = await fabric.FabricImage.fromURL(data);
          
          // ドロップした位置に配置（ズーム/パンを考慮）
          const pointer = canvas.getScenePoint(e.nativeEvent);
          img.set({
            left: pointer.x,
            top: pointer.y,
          });
          img.scaleToWidth(300); // 初期サイズを調整
          canvas.add(img);
          canvas.setActiveObject(img);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <div 
      onDragOver={(e) => e.preventDefault()} 
      onDrop={handleDrop}
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed' }}
    >
      <div style={uiOverlayStyle}>
        <h3 style={{ margin: 0 }}>PureRef Clone</h3>
        <p style={{ fontSize: '12px', opacity: 0.8 }}>
          右ドラッグ: パン | スクロール: ズーム | 画像をドロップ
        </p>
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
};

const uiOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: '20px',
  left: '20px',
  zIndex: 10,
  color: 'white',
  pointerEvents: 'none',
  fontFamily: 'sans-serif',
  background: 'rgba(0,0,0,0.5)',
  padding: '10px',
  borderRadius: '8px'
};

export default App;
