import React, { useState } from 'react';
import './ToolSideBar.css';

const ToolSideBar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Graph' | 'Edit' | 'File' | 'Run'>('Graph');

  const renderToolButtons = () => {
    switch (activeTab) {
      case 'Graph':
        return (
          <>
            <button>Pointer</button>
            <button>Text</button>
            <button>Group</button>
            <button>Chart</button>
            <button>Circle</button>
            <button>Square</button>
            <button>Diamond</button>
            <button>Arrow</button>
            <button>Play</button>
            <button>Pause</button>
            <button>Stop</button>
            <button>AP</button>
            <button>8</button>
            <button>X</button>
          </>
        );
      case 'Edit':
        return (
          <>
            <button>Select All (A)</button>
            <button>Copy (C)</button>
            <button>Paste (V)</button>
            <button>Undo (Z)</button>
            <button>Redo (Y)</button>
            <button>Zoom (M)</button>
          </>
        );
      case 'File':
        return (
          <>
            <button>New (N)</button>
            <button>Open (O)</button>
            <button>Import (I)</button>
            <button>Save (S)</button>
            <button>Export (E)</button>
            <button>Save as SVG (G)</button>
          </>
        );
      case 'Run':
        return (
          <>
            <button>Quick Run</button>
            <button>Multiple Runs</button>
            <label>Runs <input type="number" defaultValue={100} /></label>
            <label>Visible Runs <input type="number" defaultValue={25} /></label>
          </>
        );
    }
  };

  return (
    <div className="tool-sidebar">
      <div className="tab-buttons">
        {(['Graph', 'Edit', 'File', 'Run'] as const).map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <div className="tool-buttons">{renderToolButtons()}</div>
      <div className="sidebar-divider"></div>
      <div className="section-divider"></div>

{/* Optional title label */}
<div className="machinations-label">Machinations I</div>

      <div className="properties-panel">
        <label>Name <input type="text" /></label>
        <label>Author <input type="text" /></label>
        <label>Time Mode
          <select>
            <option>asynchronous</option>
            <option>synchronous</option>
          </select>
        </label>
        <label>Interval <input type="number" defaultValue={1.0} /></label>
        <label>Distribution
          <select>
            <option>fixed speed</option>
            <option>random</option>
          </select>
        </label>
        <label>Color Coding <input type="checkbox" /> Color Coded</label>
        <label>Dice <input type="text" defaultValue="D6" /></label>
        <label>Skill <input type="text" /></label>
        <label>Multiplayer <input type="text" /></label>
        <label>Strategy <input type="text" /></label>
        <label>Width <input type="number" defaultValue={600} /></label>
        <label>Height <input type="number" defaultValue={560} /></label>
      </div>
    </div>
  );
};

export default ToolSideBar;
