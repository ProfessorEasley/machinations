import React from 'react';
import TopBar from '../components/TopBar';
import ToolSideBar from '../components/ToolSideBar';
import './Playground.css';
// import ApiTester from '../components/ApiTester';

const Playground: React.FC = () => {
  return (
    <div className="playground-wrapper">
      <TopBar />
l
      <div className="playground-body">
        {/* Left canvas section */}
        <div className="canvas-section">
          <div className="grid-canvas">{/* Canvas grid goes here */}
            {/* <div style={{ position: 'absolute', top: 12, left: 12, maxWidth: 400 }}>
              <ApiTester />
            </div> */}
          </div>
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
