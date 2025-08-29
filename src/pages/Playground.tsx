import React from 'react';
import TopBar from '../components/TopBar';
import ToolSideBar from '../components/ToolSideBar';
import './Playground.css';
<<<<<<< HEAD
// import ApiTester from '../components/ApiTester';
=======
>>>>>>> 837c1f018fe6b583fd83f89ece7bda14111c4ed8

const Playground: React.FC = () => {
  return (
    <div className="playground-wrapper">
      <TopBar />

      <div className="playground-body">
        {/* Left canvas section */}
        <div className="canvas-section">
<<<<<<< HEAD
          <div className="grid-canvas">{/* Canvas grid goes here */}
            {/* <div style={{ position: 'absolute', top: 12, left: 12, maxWidth: 400 }}>
              <ApiTester />
            </div> */}
          </div>
=======
          <div className="grid-canvas">{/* Canvas grid goes here */}</div>
>>>>>>> 837c1f018fe6b583fd83f89ece7bda14111c4ed8
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
