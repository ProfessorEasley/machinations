import React from 'react';
import { fileService } from '../services/fileService';
import './FileTabs.css';

interface FileTabsProps {
  currentFileId: string | null;
  onFileSwitch: (fileId: string) => void;
  onFileClose: (fileId: string) => void;
  onNewFile: () => void;
}

const FileTabs: React.FC<FileTabsProps> = ({
  currentFileId,
  onFileSwitch,
  onFileClose,
  onNewFile,
}) => {
  const files = fileService.getAllFiles();

  const handleFileSwitch = (fileId: string) => {
    const result = fileService.switchToFile(fileId);
    if (result.success) {
      onFileSwitch(fileId);
    }
  };

  const handleFileClose = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check if file has unsaved changes
    const file = fileService.getFileById(fileId);
    if (file && file.isModified) {
      const confirmClose = window.confirm(
        `"${file.name}" has unsaved changes. Do you want to close it anyway?`
      );
      if (!confirmClose) return;
    }

    const result = fileService.closeFile(fileId);
    if (result.success) {
      onFileClose(fileId);
    }
  };

  const handleNewFile = () => {
    onNewFile();
  };

  if (files.length === 0) {
    return (
      <div className="file-tabs-container">
        <div className="file-tabs">
          <button 
            className="new-file-button"
            onClick={handleNewFile}
            title="New File (Ctrl+N)"
          >
            + New File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="file-tabs-container">
      <div className="file-tabs">
        {files.map((file) => (
          <div
            key={file.id}
            className={`file-tab ${currentFileId === file.id ? 'active' : ''} ${file.isModified ? 'modified' : ''}`}
            onClick={() => handleFileSwitch(file.id)}
            title={file.isModified ? `${file.name} (modified)` : file.name}
          >
            <span className="file-name">{file.name}</span>
            <span className="file-status">
              {file.isModified && '●'}
            </span>
            <button
              className="close-tab-button"
              onClick={(e) => handleFileClose(file.id, e)}
              title="Close file"
            >
              ×
            </button>
          </div>
        ))}
        <button 
          className="new-file-button"
          onClick={handleNewFile}
          title="New File (Ctrl+N)"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default FileTabs;
