import React, { useState, useRef } from 'react';
import { fileService, type FileData } from '../services/fileService';
import type { GraphElement } from '../types/graph';

interface FileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileOperation: (result: FileData | null) => void;
  type:
    | 'new'
    | 'open'
    | 'save'
    | 'saveAs'
    | 'import'
    | 'export'
    | 'exportSelection';
  selectedElements?: GraphElement[];
}

const FileDialogs: React.FC<FileDialogProps> = ({
  isOpen,
  onClose,
  onFileOperation,
  type,
  selectedElements = [],
}) => {
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    setError('');

    switch (type) {
      case 'new': {
        // FIX: Added braces
        const newFile = fileService.createNewFile(fileName || undefined);
        onFileOperation(newFile);
        break;
      }

      case 'save': {
        // FIX: Added braces
        const saveResult = fileService.saveCurrentFile();
        if (saveResult.success) {
          onFileOperation(saveResult.data || null);
        } else {
          setError(saveResult.error || 'Failed to save file');
          return;
        }
        break;
      }

      case 'saveAs': {
        // FIX: Added braces
        if (!fileName.trim()) {
          setError('Please enter a file name');
          return;
        }
        const saveAsResult = fileService.saveAs(fileName);
        if (saveAsResult.success) {
          onFileOperation(saveAsResult.data || null);
        } else {
          setError(saveAsResult.error || 'Failed to save file');
          return;
        }
        break;
      }

      case 'import': {
        // FIX: Added braces
        if (!fileContent.trim()) {
          setError('Please enter file content or select a file');
          return;
        }
        const importResult = fileService.importFile(
          fileContent,
          fileName || 'Imported File'
        );
        if (importResult.success) {
          onFileOperation(importResult.data || null);
        } else {
          setError(importResult.error || 'Failed to import file');
          return;
        }
        break;
      }

      case 'export': {
        // FIX: Added braces
        const currentFile = fileService.getCurrentFile();
        if (currentFile) {
          const exportResult = fileService.exportFile(currentFile.id);
          if (exportResult.success && exportResult.data) {
            // Create download link
            const dataStr = JSON.stringify(exportResult.data.content, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${exportResult.data.name}.json`;
            link.click();
            URL.revokeObjectURL(url);
            onFileOperation(null);
          } else {
            setError('Failed to export file');
            return;
          }
        }
        break;
      }

      case 'exportSelection': {
        // FIX: Added braces
        if (selectedElements.length === 0) {
          setError('No elements selected');
          return;
        }
        const selectionData = fileService.exportSelection(selectedElements);
        const selectionBlob = new Blob([selectionData], {
          type: 'application/json',
        });
        const selectionUrl = URL.createObjectURL(selectionBlob);
        const selectionLink = document.createElement('a');
        selectionLink.href = selectionUrl;
        selectionLink.download = 'selection.json';
        selectionLink.click();
        URL.revokeObjectURL(selectionUrl);
        onFileOperation(null);
        break;
      }
    }

    handleClose();
  };

  const handleClose = () => {
    setFileName('');
    setFileContent('');
    setError('');
    onClose();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name.replace(/\.[^/.]+$/, '')); // Remove extension

      const reader = new FileReader();
      reader.onload = e => {
        setFileContent(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleExportSVG = () => {
    const currentFile = fileService.getCurrentFile();
    if (currentFile) {
      const svgResult = fileService.exportAsSVG(currentFile.id);
      if (
        svgResult.success &&
        svgResult.data &&
        'svgContent' in svgResult.data
      ) {
        const svgBlob = new Blob([svgResult.data.svgContent as string], {
          type: 'image/svg+xml',
        });
        const svgUrl = URL.createObjectURL(svgBlob);
        const svgLink = document.createElement('a');
        svgLink.href = svgUrl;
        svgLink.download = `${currentFile.name}.svg`;
        svgLink.click();
        URL.revokeObjectURL(svgUrl);
        handleClose();
      }
    }
  };

  if (!isOpen) return null;

  const getTitle = () => {
    switch (type) {
      case 'new':
        return 'New File';
      case 'open':
        return 'Open File';
      case 'save':
        return 'Save File';
      case 'saveAs':
        return 'Save As';
      case 'import':
        return 'Import File';
      case 'export':
        return 'Export File';
      case 'exportSelection':
        return 'Export Selection';
      default:
        return 'File Operation';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'new':
        return 'Create a new graph file';
      case 'save':
        return 'Save the current file';
      case 'saveAs':
        return 'Save the current file with a new name';
      case 'import':
        return 'Import a graph from a JSON file';
      case 'export':
        return 'Export the current file as JSON';
      case 'exportSelection':
        return `Export ${selectedElements.length} selected elements`;
      default:
        return '';
    }
  };

  return (
    <div className="file-dialog-overlay">
      <div className="file-dialog">
        <div className="file-dialog-header">
          <h3>{getTitle()}</h3>
          <button className="close-button" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="file-dialog-content">
          <p className="dialog-description">{getDescription()}</p>

          {error && <div className="error-message">{error}</div>}

          {(type === 'new' || type === 'saveAs') && (
            <div className="form-group">
              <label htmlFor="fileName">File Name:</label>
              <input
                id="fileName"
                type="text"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                placeholder="Enter file name"
                autoFocus
              />
            </div>
          )}

          {type === 'import' && (
            <>
              <div className="form-group">
                <label htmlFor="fileUpload">Upload File:</label>
                <input
                  ref={fileInputRef}
                  id="fileUpload"
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                />
              </div>
              <div className="form-group">
                <label htmlFor="fileContent">Or paste JSON content:</label>
                <textarea
                  id="fileContent"
                  value={fileContent}
                  onChange={e => setFileContent(e.target.value)}
                  placeholder="Paste JSON content here..."
                  rows={8}
                />
              </div>
            </>
          )}

          {type === 'export' && (
            <div className="export-options">
              <button onClick={handleSubmit} className="export-button">
                Export as JSON
              </button>
              <button onClick={handleExportSVG} className="export-button">
                Export as SVG
              </button>
            </div>
          )}

          {type === 'exportSelection' && (
            <div className="export-info">
              <p>Selected elements: {selectedElements.length}</p>
              <button onClick={handleSubmit} className="export-button">
                Export Selection
              </button>
            </div>
          )}

          {type === 'save' && (
            <div className="save-info">
              <p>Save the current file</p>
            </div>
          )}
        </div>

        <div className="file-dialog-footer">
          <button onClick={handleClose} className="cancel-button">
            Cancel
          </button>
          {type !== 'export' && type !== 'exportSelection' && (
            <button onClick={handleSubmit} className="confirm-button">
              {type === 'new'
                ? 'Create'
                : type === 'saveAs'
                  ? 'Save As'
                  : type === 'import'
                    ? 'Import'
                    : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileDialogs;
