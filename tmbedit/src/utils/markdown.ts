import { Editor } from '@tiptap/react';

/**
 * Serializes the editor content to Markdown and applies custom sanitization
 * to fix common Tiptap serialization issues and ensure consistent formatting.
 * 
 * @param editor The Tiptap editor instance
 * @returns Sanitized Markdown string
 */
export const getSanitizedMarkdown = (editor: Editor): string => {
    let newContent = (editor.storage as any).markdown.getMarkdown();

    // Sanitize the generated markdown to fix serializer issues
    newContent = newContent
        .replace(/&gt;/g, '>') // Global unescape of &gt; to >
        .replace(/&lt;/g, '<') // Global unescape of &lt; to <
        .replace(/^>$/gm, '> ')
        // Fix blank lines between blockquotes (Tiptap serializes empty blockquote lines as blank)
        .replace(/(^>.*$)\n\n(^>)/gm, '$1\n> \n$2');

    return newContent;
};
