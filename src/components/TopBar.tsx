import React from 'react';
import './TopBar.css';

interface TopBarProps {
  isRunning: boolean;
  onRunClick: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ isRunning, onRunClick }) => {
  return (
    <div className="top-bar">
      <button
        className={`run-button ${isRunning ? 'running' : ''}`}
        onClick={onRunClick}
      >
        {isRunning ? '■ Stop (R)' : '▶ Run (R)'}
      </button>
    </div>
  );
};

export default TopBar;
