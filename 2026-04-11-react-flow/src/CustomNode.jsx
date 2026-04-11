import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export default memo(({ data, isConnectable }) => {
  return (
    // 修正ポイント: スタイルを当てて、見えるようにする
    <div style={{ 
      background: '#fff', 
      padding: '10px', 
      border: '1px solid #777', 
      borderRadius: '5px',
      minWidth: '100px' 
    }}>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
      />
      <div>
        <h2 style={{ fontSize: '12px', margin: 0 }}>Favicon</h2>
        <img src="favicon.svg" alt="" />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
      />
    </div>
  );
});
