import React from 'react';
import { useState } from 'react';
import TopBar from '../components/TopBar';
import ToolSideBar from '../components/ToolSideBar';
import './Playground.css';
import Canvas from '../components/Canvas';

const Playground: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<string>('Select');
  return (
    <div className="playground-wrapper">
      <TopBar />
      <div className="playground-body">
        <div className="canvas-section">
          <div className="grid-canvas">
            <Canvas selectedTool={selectedTool} />
          </div>
        </div>
        <div className="right-panel">
          <ToolSideBar
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
          />
        </div>
      </div>
    </div>
  );
};

export default Playground;
