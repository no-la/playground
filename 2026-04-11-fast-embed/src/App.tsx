import React, { useState, useEffect, useRef } from 'react';
import { pipeline, env, cos_sim, RawImage } from '@xenova/transformers';
import { Upload, Image as ImageIcon, CheckCircle2, Loader2 } from 'lucide-react';
import './App.css';

// モデルのダウンロード先をHugging Faceに設定
env.allowLocalModels = false;

const App = () => {
  const [status, setStatus] = useState('initializing'); // 'initializing' | 'ready' | 'processing'
  const [data, setData] = useState([]); // { url: string, vector: number[] }[]
  const [similarity, setSimilarity] = useState(null);
  const extractor = useRef(null);

  // 1. モデルの初期化 (image-feature-extraction を明示)
  useEffect(() => {
    const init = async () => {
      try {
        // CLIPの画像側エンジンのみを使用するように指定
        extractor.current = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
        setStatus('ready');
      } catch (err) {
        console.error("Model Init Error:", err);
        alert("モデルの読み込みに失敗しました。");
      }
    };
    init();
  }, []);

  // 2. 画像のベクトル化処理
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !extractor.current) return;

    setStatus('processing');
    const url = URL.createObjectURL(file);
    
    try {
      // 画像をONNX Runtimeが理解できるRawImage形式に変換
      const image = await RawImage.fromURL(url);
      
      // 特徴量（Embedding）の抽出
      const output = await extractor.current(image);
      
      // Float32Arrayを通常の配列に変換
      const vector = Array.from(output.data);

      // 最新の2枚を保持
      const newData = [...data, { url, vector }].slice(-2);
      setData(newData);

      // 3. 2枚揃ったら類似度を計算
      if (newData.length === 2) {
        const score = cos_sim(newData[0].vector, newData[1].vector);
        setSimilarity(score);
      }
    } catch (error) {
      console.error("Processing Error:", error);
      alert("ベクトル化中にエラーが発生しました: " + error.message);
    } finally {
      setStatus('ready');
    }
  };

  return (
    <div className="container">
      <header className="header">
        <div className="title-group">
          <h1 className="title">
            <ImageIcon className="icon-blue" /> Vector Eye
          </h1>
          <p className="subtitle">Local Image Embedding with CLIP (ViT-B-32)</p>
        </div>
        <div className={`status-badge ${status}`}>
          {status === 'initializing' ? (
            <><Loader2 className="spinner" size={14} /> Loading Model...</>
          ) : (
            <><CheckCircle2 size={14} /> Ready</>
          )}
        </div>
      </header>

      <main>
        <label className={`upload-zone ${status === 'processing' ? 'disabled' : ''}`}>
          <Upload size={48} className="upload-icon" />
          <span className="upload-text">
            {status === 'processing' ? 'Calculating Vectors...' : 'Click to Vectorize Image'}
          </span>
          <input 
            type="file" 
            className="hidden-input" 
            accept="image/*" 
            onChange={handleImageUpload} 
            disabled={status !== 'ready'} 
          />
        </label>

        <div className="results-grid">
          {data.map((item, idx) => (
            <div key={idx} className="vector-card">
              <div className="image-wrapper">
                <img src={item.url} alt="Uploaded preview" />
              </div>
              <div className="vector-details">
                <h3 className="section-label">Vector Preview (Head)</h3>
                <div className="vector-preview">
                  {item.vector.slice(0, 12).map((v, i) => (
                    <span key={i} className="vector-val">{v.toFixed(3)}</span>
                  ))}
                  <span className="vector-val dots">...</span>
                </div>
                <div className="vector-meta">Dimensions: {item.vector.length}</div>
              </div>
            </div>
          ))}
        </div>

        {data.length === 2 && similarity !== null && (
          <div className="similarity-panel">
            <span className="panel-label">Semantic Similarity Score</span>
            <div className="similarity-value">
              {(similarity * 100).toFixed(2)}%
            </div>
            <div className="progress-container">
              <div 
                className="progress-fill" 
                style={{ width: `${Math.max(0, similarity * 100)}%` }}
              ></div>
            </div>
            <p className="panel-hint">
              {similarity > 0.8 ? "Highly similar images." : "These images have different features."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
