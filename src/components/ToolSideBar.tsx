import React, { useState } from 'react';
import './ToolSideBar.css';

const graphTools = [
  'Select',
  'Text Label',
  'Group',
  'Chart',
  'Pool',
  'Gate',
  'Resource Connection',
  'State Connection',
  'Source',
  'Drain',
  'Convertor',
  'Trader',
  'Delay',
  'Register',
  'End Condition',
  'Artifical Intelligence',
];

const ToolSideBar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Graph' | 'Edit' | 'File' | 'Run'>(
    'Graph'
  );
  const [selectedTool, setSelectedTool] = useState<string>('Select');

  const renderToolButtons = () => {
    switch (activeTab) {
      case 'Graph':
        return (
          <>
            {graphTools.map(tool => (
              <button
                key={tool}
                className={selectedTool === tool ? 'selected' : ''}
                onClick={() => setSelectedTool(tool)}
              >
                {tool}
              </button>
            ))}
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
            <button>Export Selection(E)</button>
            <button>Save as SVG (G)</button>
          </>
        );
      case 'Run':
        return (
          <>
            <button>Quick Run</button>
            <button>Multiple Runs</button>
            <label>
              Runs <input type="number" defaultValue={100} />
            </label>
            <label>
              Visible Runs <input type="number" defaultValue={25} />
            </label>
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
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tool-buttons">{renderToolButtons()}</div>
      <div className="sidebar-divider"></div>
      <div className="section-divider"></div>

      {/* Optional title label */}
      <div className="machinations-label">Machinations</div>

      <div className="properties-panel">
        <label>
          Name <input type="text" />
        </label>
        <label>
          Author <input type="text" />
        </label>
        <label>
          Time Mode
          <select>
            <option>asynchronous</option>
            <option>synchronous</option>
            <option>turn-based</option>
          </select>
        </label>
        <label>
          Interval <input type="number" defaultValue={1.0} />
        </label>
        <label>
          Distribution
          <select>
            <option>instantaneous</option>
            <option>fixed speed</option>
          </select>
        </label>
        <label>
          Color Coding <input type="checkbox" /> Color Coded
        </label>
        <label>
          Dice <input type="text" defaultValue="D6" />
        </label>
        <label>
          Skill <input type="text" />
        </label>
        <label>
          Multiplayer <input type="text" />
        </label>
        <label>
          Strategy <input type="text" />
        </label>
        <label>
          Width <input type="number" defaultValue={600} />
        </label>
        <label>
          Height <input type="number" defaultValue={560} />
        </label>
      </div>
    </div>
  );
};

export default ToolSideBar;
