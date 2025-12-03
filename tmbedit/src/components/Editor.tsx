import { useEditor, EditorContent, Extension, Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { useEffect, useRef, useState } from 'react';
import CharacterCount from '@tiptap/extension-character-count';
import { SpellCheck } from '../extensions/SpellCheck';

import ContextMenu from './ContextMenu';

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
            if (!isSourceMode) {
                let newContent = (editor.storage as any).markdown.getMarkdown();

                // Sanitize the generated markdown to fix serializer issues
                newContent = newContent
                    .replace(/\\\*&gt;/g, '>')
                    .replace(/\\\*>/g, '>')
                    .replace(/^\\&gt;/gm, '>')
                    .replace(/^&gt;/gm, '>')
                    .replace(/^\*>/gm, '>')
                    .replace(/^\*&gt;/gm, '>')
                    .replace(/^>$/gm, '> ')
                    // Fix blank lines between blockquotes (Tiptap serializes empty blockquote lines as blank)
                    .replace(/(^>.*$)\n\n(^>)/gm, '$1\n> \n$2');

                // console.log("Generated Markdown (Sanitized):", newContent.substring(newContent.indexOf("Nailed it") - 20, newContent.indexOf("Nailed it") + 20));

                // Only update if content actually changed to avoid loops
                if (newContent !== lastEmittedContent.current) {
                    lastEmittedContent.current = newContent;
                    onChange(newContent);
                }
            }

            // Update stats
            const words = editor.storage.characterCount.words();
            const characters = editor.storage.characterCount.characters();
            const misspelled = (editor.storage as any).spellCheck?.errorCount || 0;
            onStatsChange({ words, characters, misspelled });
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
        if (editor && content && !isSourceMode) {
            // If the content is what we just emitted, don't reset the editor
            if (content === lastEmittedContent.current) {
                return;
            }

            isRestoring.current = true;

            // Sanitize content to fix common parsing issues
            // 1. Fix double spaces in blockquotes (>  text -> > text)
            // 2. Fix escaped blockquotes (\*&gt; -> >) and (\*> -> >)
            // Note: In Regex, to match a literal backslash, we need \\. In JS string, that's \\\\.
            // But here we are using regex literals. /\\/ matches a single backslash.
            // So /\\\*/ matches \* (backslash asterisk).
            const sanitized = content
                .replace(/^>  /gm, '> ')
                .replace(/\\\*&gt;/g, '>') // Matches \*&gt; ? No, wait. /\\/ matches \. /\*/ matches *. So /\\\*/ matches \*.
                .replace(/\\\\*&gt;/g, '>') // Try matching literal backslash explicitly
                .replace(/\\\*>/g, '>')
                .replace(/^\\&gt;/gm, '>')
                .replace(/^&gt;/gm, '>')
                .replace(/^\*>/gm, '>')      // Handle *> at start of line
                .replace(/^\*&gt;/gm, '>')   // Handle *&gt; at start of line
                .replace(/^>$/gm, '> '); // Normalize bare > to > with space

            // console.log("Loading Content (Raw):", content.substring(content.indexOf("Nailed it") - 20, content.indexOf("Nailed it") + 20));
            // console.log("Loading Content (Sanitized):", sanitized.substring(sanitized.indexOf("Nailed it") - 20, sanitized.indexOf("Nailed it") + 20));

            // Debug: Log parsed tokens
            const parser = (editor.storage as any).markdown.parser;
            if (parser) {
                // const tokens = parser.parse(sanitized, {});
                // console.log("Markdown Tokens:", JSON.stringify(tokens, null, 2));
            }

            editor.commands.setContent(sanitized);
            // console.log("Editor HTML after load:", editor.getHTML());
            // console.log("Editor JSON after load:", JSON.stringify(editor.getJSON(), null, 2));

            // Update lastEmittedContent to match what we just loaded
            // This prevents the subsequent onUpdate from triggering another onChange if it matches
            // But onUpdate will fire with the *parsed* content, which might differ from sanitized.
            // So we should probably let onUpdate handle the sync.
            // However, if we don't update lastEmittedContent here, and onUpdate fires with the SAME content,
            // it will call onChange, which is fine.
            // But if onUpdate DOESN'T fire (e.g. setContent doesn't trigger it? It usually does),
            // then we are out of sync.

            // Actually, setContent DOES trigger onUpdate.
            // So onUpdate will run, get the markdown, and call onChange.
            // So lastEmittedContent will be updated there.

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
            <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => onChange(e.target.value)}
                className="source-editor"
                onSelect={(e) => {
                    cursorPos.current = e.currentTarget.selectionStart;
                }}
                onClick={(e) => {
                    cursorPos.current = e.currentTarget.selectionStart;
                }}
                onKeyUp={(e) => {
                    cursorPos.current = e.currentTarget.selectionStart;
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const target = e.target as HTMLTextAreaElement;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const value = target.value;
                        target.value = value.substring(0, start) + '    ' + value.substring(end);
                        target.selectionStart = target.selectionEnd = start + 4;
                        onChange(target.value);
                        cursorPos.current = target.selectionStart;
                    }
                }}
                spellCheck={true}
            />
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
