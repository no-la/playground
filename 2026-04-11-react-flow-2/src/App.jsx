import React, { useCallback, useState } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  applyNodeChanges, 
  ReactFlowProvider,
  NodeResizer 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css'; // スタイルのパスが変更されています

// --- カスタムノードの定義 ---

const ResizableNode = ({ children, selected, label }) => (
  <div style={nodeContainerStyle}>
    {/* 選択時のみリサイズハンドルを表示 */}
    <NodeResizer 
      color="#007bff" 
      isVisible={selected} 
      minWidth={150} 
      minHeight={150} 
    />
    <div style={labelStyle}>{label}</div>
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {children}
    </div>
  </div>
);

const ImageNode = ({ data, selected }) => (
  <ResizableNode selected={selected} label="IMAGE">
    <img src={data.url} alt="" style={mediaStyle} />
  </ResizableNode>
);

const VideoNode = ({ data, selected }) => (
  <ResizableNode selected={selected} label="VIDEO">
    <video src={data.url} controls style={mediaStyle} />
  </ResizableNode>
);

const EmbedNode = ({ data, selected }) => (
  <ResizableNode selected={selected} label="EMBED / PDF">
    <iframe src={data.url} title="embed" style={{ ...mediaStyle, background: '#fff' }} />
  </ResizableNode>
);

const nodeTypes = {
  image: ImageNode,
  video: VideoNode,
  embed: EmbedNode,
};

// YouTubeのURLを埋め込み形式に変換する関数
const getYouTubeEmbedUrl = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) 
    ? `https://www.youtube.com/embed/${match[2]}` 
    : url;
};

// --- メインコンポーネント ---

const App = () => {
  const [nodes, setNodes] = useState([]);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onDrop = (e) => {
    e.preventDefault();

  // 1. テキスト（URLなど）がドロップされた場合
  const urlData = e.dataTransfer.getData('text');
    if (urlData && urlData.startsWith('http')) {
      const isYouTube = urlData.includes('youtube.com') || urlData.includes('youtu.be');
      const finalUrl = isYouTube ? getYouTubeEmbedUrl(urlData) : urlData;
      
      const newNode = {
        id: `node_${Date.now()}`,
        type: 'embed',
        position: { x: e.clientX - 200, y: e.clientY - 100 },
        data: { url: finalUrl },
        style: { width: 480, height: 270 },
      };
      setNodes((nds) => nds.concat(newNode));
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    
    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      const id = `node_${Date.now()}_${index}`;
      
      let type = 'image';
      if (file.type.includes('video')) type = 'video';
      if (file.type.includes('pdf')) type = 'embed';

      const newNode = {
        id,
        type,
        // ドロップ位置付近に配置
        position: { x: e.clientX - 200, y: e.clientY - 100 },
        data: { url },
        // xyflowではstyleで初期サイズを渡すとリサイズがスムーズ
        style: { width: 300, height: 250 },
      };

      setNodes((nds) => nds.concat(newNode));
    });
  };

  return (
    <div 
      onDrop={onDrop} 
      onDragOver={(e) => e.preventDefault()}
      style={{ width: '100vw', height: '100vh', backgroundColor: '#121212' }}
    >
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        nodesConnectable={false} // PureRef風なので線は引かない
        fitView
        colorMode="dark" // xyflow v12の新機能: ダークモード
      >
        <Background color="#333" gap={25} variant="dots" />
        <Controls />
      </ReactFlow>

      <div style={guideStyle}>
        画像をドロップで追加 | クリックして隅をドラッグでリサイズ
      </div>
    </div>
  );
};

// --- スタイル定義 ---

const nodeContainerStyle = {
  width: '100%',
  height: '100%',
  padding: '8px',
  background: '#2a2a2a',
  border: '1px solid #444',
  borderRadius: '8px',
  boxShadow: '0 10px 20px rgba(0,0,0,0.4)',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box'
};

const labelStyle = {
  color: '#888',
  fontSize: '10px',
  marginBottom: '5px',
  fontWeight: 'bold',
  letterSpacing: '1px'
};

const mediaStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  border: 'none'
};

const guideStyle = {
  position: 'absolute',
  bottom: '30px',
  left: '50%',
  transform: 'translateX(-50%)',
  color: '#555',
  zIndex: 10,
  fontSize: '12px',
  pointerEvents: 'none'
};

export default () => (
  <ReactFlowProvider>
    <App />
  </ReactFlowProvider>
);
