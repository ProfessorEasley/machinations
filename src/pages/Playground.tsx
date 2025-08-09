import React from 'react';
import TopBar from '../components/TopBar';
import ToolSideBar from '../components/ToolSideBar';
import './Playground.css';

const Playground: React.FC = () => {
  return (
    <div className="playground-wrapper">
      <TopBar />

      <div className="playground-body">
        {/* Left canvas section */}
        <div className="canvas-section">
          <div className="grid-canvas">{/* Canvas grid goes here */}</div>
        </div>

        {/* Right panel with toolbar and form fields */}
        <div className="right-panel">
          <ToolSideBar />
        </div>
      </div>
    </div>
  );
};

export default Playground;
