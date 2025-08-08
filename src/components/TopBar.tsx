import React from 'react';
import './TopBar.css';

const TopBar: React.FC = () => {
  return (
    <div className="top-bar">
      <button className="run-button">▶ Run (R)</button>
    </div>
  );
};

export default TopBar;
