import { useState, useEffect, useRef } from "react";
import "./App.css";
import Editor from "./components/Editor";
import Notification from "./components/Notification";
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Editor as TiptapEditor } from '@tiptap/react';
import { getSanitizedMarkdown } from './utils/markdown';

// Icons
const IconNew = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
);
const IconOpen = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 13h6m-3-3v6m-9 1V7a2 2 0 0 1 2-2h6l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
);
const IconSave = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
);
const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);
const IconCode = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
);
const IconSettings = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
);
const IconQuestion = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
);


function App() {
  const [content, setContent] = useState("# Welcome to your new editor\n\nStart typing...");
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [stats, setStats] = useState({ words: 0, characters: 0, misspelled: 0 });
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [fontSize, setFontSize] = useState('medium'); // small, medium, large
  const [fontFamily, setFontFamily] = useState('sans'); // sans, serif, mono
  const [theme, setTheme] = useState('light'); // light, dark
  const [notification, setNotification] = useState<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const cheatsheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
      if (cheatsheetRef.current && !cheatsheetRef.current.contains(event.target as Node)) {
        setShowCheatsheet(false);
      }
    };

    if (showSettings || showCheatsheet) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings, showCheatsheet]);



  // Force re-render to update button states
  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const updateHandler = () => setForceUpdate(n => n + 1);
    editor.on('selectionUpdate', updateHandler);
    editor.on('transaction', updateHandler);

    return () => {
      editor.off('selectionUpdate', updateHandler);
      editor.off('transaction', updateHandler);
    };
  }, [editor]);

  // Check for startup file
  useEffect(() => {
    invoke<[string, string] | null>('get_startup_file').then((result) => {
      if (result) {
        const [path, fileContent] = result;
        setFilePath(path);
        setContent(fileContent);
        // If editor is already ready, update it too
        if (editor) {
          editor.commands.setContent(fileContent);
        }
      }
    }).catch(err => console.error("Failed to check startup file:", err));
  }, []); // Run once on mount

  // Sync content to editor when content state changes (e.g. from startup file)
  useEffect(() => {
    if (editor && content && editor.getText() !== content) {
      // Only update if significantly different to avoid cursor jumps? 
      // Actually, for startup load, we just want to set it.
      // But we need to be careful not to overwrite user typing if this effect runs late.
      // The startup load should happen very early.
      // Let's rely on the startup effect setting it directly if editor exists, 
      // or passing it to Editor component via props (which it already does).

      // The Editor component takes `content` prop. Let's see how it handles updates.
      // If Editor.tsx handles content prop updates, we are good.
      // If not, we might need to force it.
    }
  }, [content, editor]);

  // Apply Settings via CSS Variables
  useEffect(() => {
    const root = document.documentElement;

    // Font Size
    let sizeValue = '1.1rem';
    if (fontSize === 'small') sizeValue = '0.9rem';
    if (fontSize === 'large') sizeValue = '1.3rem';
    root.style.setProperty('--editor-font-size', sizeValue);

    // Font Family
    let familyValue = "'Inter', sans-serif";
    if (fontFamily === 'serif') familyValue = "'Merriweather', serif";
    if (fontFamily === 'mono') familyValue = "'Fira Code', monospace";
    root.style.setProperty('--editor-font-family', familyValue);

    // Theme
    root.setAttribute('data-theme', theme);
  }, [fontSize, fontFamily, theme]);


  const handleNew = async () => {
    // TODO: Check for unsaved changes?
    setContent("");
    setFilePath(null);
    if (editor) {
      editor.commands.setContent("");
    }
  };

  const handleOpen = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown', 'txt']
        }]
      });

      if (selected && typeof selected === 'string') {
        const fileContent = await invoke<string>('read_file', { path: selected });
        setContent(fileContent);
        setFilePath(selected);
      }
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  const handleSave = async () => {
    try {
      let path = filePath;
      if (!path) {
        path = await save({
          filters: [{
            name: 'Markdown',
            extensions: ['md', 'markdown', 'txt']
          }]
        });
      }

      if (path) {
        // Force sync content if in WYSIWYG mode to get latest changes
        let contentToSave = content;
        if (!isSourceMode && editor) {
          contentToSave = getSanitizedMarkdown(editor);
          setContent(contentToSave);
        }

        await invoke('write_file', { path, content: contentToSave });
        setFilePath(path);
        setNotification("File Saved");
      }
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'q') {
          event.preventDefault();
          await invoke('exit_app');
        } else if (event.key === 's') {
          event.preventDefault();
          await handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <div className="app-container">
      <header className="toolbar">
        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${!isSourceMode ? 'active' : ''}`}
            onClick={() => setIsSourceMode(false)}
            title="WYSIWYG Mode"
          >
            <IconEye />
          </button>
          <button
            className={`toolbar-btn ${isSourceMode ? 'active' : ''}`}
            onClick={() => {
              // Force sync before switching to Source Mode
              if (!isSourceMode && editor) {
                const newContent = getSanitizedMarkdown(editor);
                setContent(newContent);
              }
              setIsSourceMode(true);
            }}
            title="Source Mode"
          >
            <IconCode />
          </button>

          <div className="separator-vertical"></div>

          <div className="cheatsheet-wrapper" style={{ position: 'relative' }} ref={cheatsheetRef}>
            <button
              className={`toolbar-btn ${showCheatsheet ? 'active' : ''}`}
              onClick={() => setShowCheatsheet(!showCheatsheet)}
              title="Markdown Cheatsheet"
            >
              <IconQuestion />
            </button>
            {showCheatsheet && (
              <div className="cheatsheet-menu">
                <div className="cheatsheet-grid">
                  <span>Bold</span> <code>**text**</code>
                  <span>Italic</span> <code>*text*</code>
                  <span>H1</span> <code># Text</code>
                  <span>H2</span> <code>## Text</code>
                  <span>Blockquote</span> <code>&gt; text</code>
                  <span>List (Bullet)</span> <code>- item</code>
                  <span>List (Ordered)</span> <code>1. item</code>
                  <span>Code (Inline)</span> <code>`text`</code>
                  <span>Code (Block)</span> <code style={{ whiteSpace: 'pre' }}>{`\`\`\`
block
\`\`\``}</code>
                  <span>Horizontal Rule</span> <code>---</code>
                  <span>Link</span> <code>[text](url)</code>
                  <span>Image</span> <code>![alt](url)</code>
                </div>
              </div>
            )}
          </div>
          <button
            className={`toolbar-btn ${editor && editor.isActive('italic') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            disabled={isSourceMode || !editor}
            title="Italic (Ctrl+I)"
          >
            <span style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: '1.2em' }}>I</span>
          </button>
        </div>

        <div className="toolbar-title">
          {filePath ? filePath.split(/[/\\]/).pop() : 'Untitled'}
        </div>

        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={handleNew} title="New Document">
            <IconNew />
          </button>
          <button className="toolbar-btn" onClick={handleOpen} title="Open File">
            <IconOpen />
          </button>
          <button className="toolbar-btn" onClick={handleSave} title="Save File">
            <IconSave />
          </button>

          <div className="separator-vertical"></div>

          <div className="settings-wrapper" style={{ position: 'relative' }} ref={settingsRef}>
            <button
              className={`toolbar-btn ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <IconSettings />
            </button>

            {showSettings && (
              <div className="settings-menu">
                <div className="settings-section">
                  <label>Font Size</label>
                  <div className="settings-options">
                    <button className={fontSize === 'small' ? 'active' : ''} onClick={() => setFontSize('small')}>S</button>
                    <button className={fontSize === 'medium' ? 'active' : ''} onClick={() => setFontSize('medium')}>M</button>
                    <button className={fontSize === 'large' ? 'active' : ''} onClick={() => setFontSize('large')}>L</button>
                  </div>
                </div>
                <div className="settings-section">
                  <label>Font Family</label>
                  <div className="settings-options">
                    <button className={fontFamily === 'sans' ? 'active' : ''} onClick={() => setFontFamily('sans')}>Sans</button>
                    <button className={fontFamily === 'serif' ? 'active' : ''} onClick={() => setFontFamily('serif')}>Serif</button>
                    <button className={fontFamily === 'mono' ? 'active' : ''} onClick={() => setFontFamily('mono')}>Mono</button>
                  </div>
                </div>
                <div className="settings-section">
                  <label>Theme</label>
                  <div className="settings-options">
                    <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button>
                    <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="editor-container">
        <Editor
          content={content}
          onChange={setContent}
          isSourceMode={isSourceMode}
          onStatsChange={setStats}
          onEditorReady={setEditor}
        />
      </main>

      <footer className="footer">
        <span>{stats.words} words</span>
        <span className="separator">|</span>
        <span>{stats.characters} characters</span>
        <span className="separator">|</span>
        <span style={{ color: stats.misspelled > 0 ? 'red' : 'inherit' }}>
          {stats.misspelled} errors
        </span>
      </footer>
      {notification && (
        <Notification
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}

export default App;
