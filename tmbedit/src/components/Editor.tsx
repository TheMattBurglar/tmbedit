import { useEditor, EditorContent, Extension, Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { useEffect, useRef, useState } from 'react';
import CharacterCount from '@tiptap/extension-character-count';
import { SpellCheck } from '../extensions/SpellCheck';
import { getSanitizedMarkdown } from '../utils/markdown';

import ContextMenu from './ContextMenu';
import CodeEditor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism.css'; // Basic theme, overridden by App.css

interface EditorProps {
    content: string;
    onChange: (content: string) => void;
    isSourceMode: boolean;
    onStatsChange: (stats: { words: number; characters: number; misspelled: number }) => void;
    onEditorReady: (editor: TiptapEditor | null) => void;
}

const Editor = ({ content, onChange, isSourceMode, onStatsChange, onEditorReady }: EditorProps) => {
    const lastEmittedContent = useRef(content);
    const cursorPos = useRef(0);
    const isRestoring = useRef(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        suggestions: string[];
        word: string;
        from: number;
        to: number;
    } | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Markdown.configure({
                html: false,
                transformPastedText: true,
                transformCopiedText: true,
                tightLists: false,
                bulletListMarker: '-',
            }),
            // Typography,
            CharacterCount,
            SpellCheck,
            Extension.create({
                name: 'tabKey',
                addKeyboardShortcuts() {
                    return {
                        Tab: () => {
                            if (this.editor.can().sinkListItem('listItem')) {
                                return this.editor.commands.sinkListItem('listItem');
                            }
                            return this.editor.commands.insertContent({ type: 'text', text: '    ' });
                        },
                        'Shift-Tab': () => {
                            if (this.editor.can().liftListItem('listItem')) {
                                return this.editor.commands.liftListItem('listItem');
                            }
                            return false;
                        },
                    };
                },
            }),
        ],
        editorProps: {
            attributes: {
                // class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none h-full p-4',
                // Removed redundant tailwind classes since we are using custom CSS in App.css
                spellcheck: 'false',
            },
            handleDOMEvents: {
                contextmenu: (_view, event) => {
                    const target = event.target as HTMLElement;
                    if (target.classList.contains('spell-error')) {
                        event.preventDefault();
                        return false;
                    }
                    return false;
                }
            }
        },
        content,
        onUpdate: ({ editor }) => {
            // We only want to trigger onChange if we are in WYSIWYG mode
            // If we are in source mode, the textarea handles the change
            // Clear previous timeout if exists
            if ((editor.storage as any).debounceTimeout) {
                clearTimeout((editor.storage as any).debounceTimeout);
            }

            if (!isSourceMode) {
                // Debounce the update to avoid lag on every keystroke
                const timeoutId = setTimeout(() => {
                    const newContent = getSanitizedMarkdown(editor);
                    if (newContent !== lastEmittedContent.current) {
                        lastEmittedContent.current = newContent;
                        onChange(newContent);
                    }

                    // Update stats (debounced)
                    const words = editor.storage.characterCount.words();
                    const characters = editor.storage.characterCount.characters();
                    const misspelled = (editor.storage as any).spellCheck?.errorCount || 0;
                    onStatsChange({ words, characters, misspelled });

                }, 750); // 750ms debounce

                // Store timeout to clear on next update or unmount
                (editor.storage as any).debounceTimeout = timeoutId;
            }
        },
        onSelectionUpdate: ({ editor }) => {
            if (!isSourceMode && !isRestoring.current) {
                cursorPos.current = editor.state.selection.from;
            }
        },
        onCreate: ({ editor }) => {
            onEditorReady(editor);
        },
        onDestroy: () => {
            onEditorReady(null);
        }
    });

    // Sync content when it changes externally (e.g. from loading a file or switching modes)
    useEffect(() => {
        if (editor && content) {
            // Prevent loop if content matches last emitted
            if (content === lastEmittedContent.current) {
                return;
            }

            isRestoring.current = true;

            // Sanitize content to fix common parsing issues
            const sanitized = content
                .replace(/^>  /gm, '> ')
                .replace(/\\\*&gt;/g, '>') // Matches \*&gt; ? No, wait. /\\/ matches \. /\*/ matches *. So /\\\*/ matches \*.
                .replace(/\\\\*&gt;/g, '>') // Try matching literal backslash explicitly
                .replace(/\\\*>/g, '>')
                .replace(/^\\&gt;/gm, '>')
                .replace(/^&gt;/gm, '>')
                .replace(/&gt;/g, '>') // Global unescape of &gt; to >
                .replace(/^\*>/gm, '>')      // Handle *> at start of line
                .replace(/^\*&gt;/gm, '>')   // Handle *&gt; at start of line
                .replace(/^>$/gm, '> '); // Normalize bare > to > with space

            editor.commands.setContent(sanitized);

            // Restore cursor position when switching back to WYSIWYG
            setTimeout(() => {
                if (!editor.isDestroyed) {
                    // We need to focus first, then set selection
                    editor.commands.focus();
                    editor.commands.setTextSelection(cursorPos.current);
                    editor.commands.scrollIntoView();
                    isRestoring.current = false;
                }
            }, 100);
        }
    }, [content, editor, isSourceMode]);

    // Restore cursor position when switching to Source Mode
    useEffect(() => {
        if (isSourceMode && textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.focus();
            textarea.setSelectionRange(cursorPos.current, cursorPos.current);

            // Let the browser handle scrolling to the selection naturally.
            // Manual calculation is error-prone due to text wrapping.
            textarea.blur();
            textarea.focus();
        }
    }, [isSourceMode]);


    // Handle Context Menu via Wrapper
    const handleContextMenu = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('spell-error') && editor) {
            e.preventDefault();
            const word = target.dataset.word || '';
            const from = parseInt(target.dataset.from || '0', 10);
            const to = parseInt(target.dataset.to || '0', 10);
            // Show menu immediately with empty suggestions
            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                suggestions: [],
                word,
                from,
                to,
            });

            // Fetch suggestions asynchronously to avoid blocking the UI
            setTimeout(async () => {
                const suggestions = await (editor.storage as any).spellCheck.getSuggestions(word);
                setContextMenu(prev => prev ? { ...prev, suggestions } : null);
            }, 0);
        } else {
            setContextMenu(null);
        }
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    const handleSelectSuggestion = (suggestion: string) => {
        if (!editor || !contextMenu) return;

        // Replace the word using stored positions without forcing scroll
        editor.chain()
            .deleteRange({ from: contextMenu.from, to: contextMenu.to })
            .insertContentAt(contextMenu.from, suggestion)
            .run();

        // Restore focus gently
        editor.view.focus();

        handleCloseContextMenu();
    };

    const handleAddToDictionary = () => {
        if (!editor || !contextMenu) return;
        (editor.storage as any).spellCheck.addWord(contextMenu.word);
        // Force re-evaluation
        editor.view.dispatch(editor.state.tr);
        handleCloseContextMenu();
    };

    if (isSourceMode) {
        return (
            <div className="source-editor-container" style={{ height: '100%', overflow: 'auto' }}>
                <CodeEditor
                    value={content}
                    onValueChange={code => onChange(code)}
                    highlight={code => highlight(code, languages.markdown, 'markdown')}
                    padding={32} // Match the 2rem (32px) padding of the previous textarea
                    className="source-editor-code"
                    style={{
                        fontFamily: '"Fira Code", "Roboto Mono", monospace',
                        fontSize: '1rem',
                        minHeight: '100%',
                    }}
                    textareaId="source-textarea"
                />
            </div>
        );
    }

    return (
        <div className="editor-wrapper" onContextMenu={handleContextMenu}>
            <EditorContent editor={editor} className="min-h-full" />

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    suggestions={contextMenu.suggestions}
                    onSelect={handleSelectSuggestion}
                    onAdd={handleAddToDictionary}
                    onClose={handleCloseContextMenu}
                />
            )}
        </div>
    );
};

export default Editor;
