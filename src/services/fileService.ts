import type { GraphElement } from '../types/graph';

export interface FileData {
  id: string;
  name: string;
  content: {
    elements: GraphElement[];
    metadata: {
      createdAt: string;
      modifiedAt: string;
      version: string;
    };
  };
  isModified: boolean;
  path?: string;
}

export interface FileOperationResult {
  success: boolean;
  data?: FileData;
  error?: string;
}

class FileService {
  private files: Map<string, FileData> = new Map();
  private currentFileId: string | null = null;
  private fileCounter = 1;

  constructor() {
    // Initialize with a default untitled file
    this.createNewFile();
  }

  // Create a new file
  createNewFile(name?: string): FileData {
    const fileName = name || `Untitled ${this.fileCounter++}`;
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newFile: FileData = {
      id: fileId,
      name: fileName,
      content: {
        elements: [],
        metadata: {
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          version: '1.0.0',
        },
      },
      isModified: false,
    };

    this.files.set(fileId, newFile);
    this.currentFileId = fileId;
    
    return newFile;
  }

  // Get current file
  getCurrentFile(): FileData | null {
    return this.currentFileId ? this.files.get(this.currentFileId) || null : null;
  }

  // Get all files
  getAllFiles(): FileData[] {
    return Array.from(this.files.values());
  }

  // Switch to a file
  switchToFile(fileId: string): FileOperationResult {
    if (!this.files.has(fileId)) {
      return { success: false, error: 'File not found' };
    }
    
    this.currentFileId = fileId;
    return { success: true, data: this.files.get(fileId)! };
  }

  // Save current file
  saveCurrentFile(): FileOperationResult {
    if (!this.currentFileId) {
      return { success: false, error: 'No file is currently open' };
    }

    const file = this.files.get(this.currentFileId);
    if (!file) {
      return { success: false, error: 'File not found' };
    }

    // Update metadata
    file.content.metadata.modifiedAt = new Date().toISOString();
    file.isModified = false;

    // In a real app, this would save to backend/storage
    console.log('Saving file:', file.name, file.content);
    
    return { success: true, data: file };
  }

  // Save file with new name
  saveAs(newName: string): FileOperationResult {
    if (!this.currentFileId) {
      return { success: false, error: 'No file is currently open' };
    }

    const currentFile = this.files.get(this.currentFileId);
    if (!currentFile) {
      return { success: false, error: 'File not found' };
    }

    // Create new file with the new name
    const newFile = {
      ...currentFile,
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newName,
      isModified: false,
      content: {
        ...currentFile.content,
        metadata: {
          ...currentFile.content.metadata,
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        },
      },
    };

    this.files.set(newFile.id, newFile);
    this.currentFileId = newFile.id;

    return { success: true, data: newFile };
  }

  // Close a file
  closeFile(fileId: string): FileOperationResult {
    if (!this.files.has(fileId)) {
      return { success: false, error: 'File not found' };
    }
    
    // If closing current file, switch to another file or create new one
    if (this.currentFileId === fileId) {
      const remainingFiles = Array.from(this.files.keys()).filter(id => id !== fileId);
      if (remainingFiles.length > 0) {
        this.currentFileId = remainingFiles[0];
      } else {
        // Create new file if no files left
        this.createNewFile();
      }
    }

    this.files.delete(fileId);
    return { success: true };
  }

  // Update file content
  updateFileContent(fileId: string, elements: GraphElement[]): FileOperationResult {
    const file = this.files.get(fileId);
    if (!file) {
      return { success: false, error: 'File not found' };
    }

    file.content.elements = elements;
    file.content.metadata.modifiedAt = new Date().toISOString();
    file.isModified = true;

    return { success: true, data: file };
  }

  // Import file from JSON
  importFile(fileContent: string, fileName: string): FileOperationResult {
    try {
      const parsed = JSON.parse(fileContent);
      
      if (!parsed.elements || !Array.isArray(parsed.elements)) {
        return { success: false, error: 'Invalid file format' };
      }

      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const importedFile: FileData = {
        id: fileId,
        name: fileName,
        content: {
          elements: parsed.elements,
          metadata: {
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            version: parsed.metadata?.version || '1.0.0',
          },
        },
        isModified: false,
      };

      this.files.set(fileId, importedFile);
      this.currentFileId = fileId;

      return { success: true, data: importedFile };
    } catch (error) {
      return { success: false, error: `Failed to parse file ${error}` };
    }
  }

  // Export file to JSON
  exportFile(fileId: string): FileOperationResult {
    const file = this.files.get(fileId);
    if (!file) {
      return { success: false, error: 'File not found' };
    }

    const exportData = {
      ...file.content,
      exportedAt: new Date().toISOString(),
    };

    return { success: true, data: { ...file, content: exportData } as FileData };
  }

  // Export selection to JSON
  exportSelection(elements: GraphElement[]): string {
    return JSON.stringify({
      elements,
      exportedAt: new Date().toISOString(),
      type: 'selection',
    }, null, 2);
  }

  // Export as SVG (placeholder - would need canvas to SVG conversion)
  exportAsSVG(fileId: string): FileOperationResult {
    const file = this.files.get(fileId);
    if (!file) {
      return { success: false, error: 'File not found' };
    }

    // This is a placeholder - in a real implementation, you'd convert the canvas to SVG
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="white"/>
      <text x="400" y="300" text-anchor="middle">SVG Export for: ${file.name}</text>
      <text x="400" y="320" text-anchor="middle">Elements: ${file.content.elements.length}</text>
    </svg>`;

    return { success: true, data: { ...file, svgContent } as FileData & { svgContent: string } };
  }

  // Check if current file is modified
  isCurrentFileModified(): boolean {
    const file = this.getCurrentFile();
    return file ? file.isModified : false;
  }

  // Get file by ID
  getFileById(fileId: string): FileData | null {
    return this.files.get(fileId) || null;
  }

  // Rename file
  renameFile(fileId: string, newName: string): FileOperationResult {
    const file = this.files.get(fileId);
    if (!file) {
      return { success: false, error: 'File not found' };
    }

    file.name = newName;
    file.content.metadata.modifiedAt = new Date().toISOString();
    file.isModified = true;

    return { success: true, data: file };
  }
}

// Create singleton instance
export const fileService = new FileService();
export default fileService;
