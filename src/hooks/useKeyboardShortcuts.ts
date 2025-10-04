import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export const useKeyboardShortcuts = () => {
  const {
    openFileDialog,
    saveCurrentFile,
    createNewFile,
    exportCurrentFile,
    exportSelection,
    selectedElements,
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // Handle keyboard shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'n':
            event.preventDefault();
            openFileDialog('new');
            break;
          case 'o':
            event.preventDefault();
            openFileDialog('open');
            break;
          case 's':
            event.preventDefault();
            if (event.shiftKey) {
              // Ctrl+Shift+S for Save As
              openFileDialog('saveAs');
            } else {
              // Ctrl+S for Save
              saveCurrentFile();
            }
            break;
          case 'i':
            event.preventDefault();
            openFileDialog('import');
            break;
          case 'e':
            event.preventDefault();
            if (selectedElements.length > 0) {
              exportSelection();
            } else {
              exportCurrentFile();
            }
            break;
          case 'g':
            event.preventDefault();
            // Export as SVG
            console.log('Export as SVG shortcut triggered');
            break;
        }
      }

      // Handle other shortcuts
      switch (event.key.toLowerCase()) {
        case 'f5':
          event.preventDefault();
          // Refresh/reload simulation
          console.log('F5 - Quick run shortcut');
          break;
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openFileDialog, saveCurrentFile, createNewFile, exportCurrentFile, exportSelection, selectedElements]);
};
