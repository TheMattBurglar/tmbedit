import { Editor } from '@tiptap/react';

/**
 * Common sanitization rules to fix Tiptap serialization/deserialization frequency issues.
 * These are applied both when loading content into the editor (to fix existing files)
 * and when generating Markdown/saving (to ensure clean output).
 * 
 * @param text The markdown text to sanitize
 * @returns Sanitized markdown string
 */
export const sanitizeMarkdown = (text: string): string => {
    return text
        .replace(/^>  /gm, '> ')
        // Fix escaped > characters which sometimes happens with Tiptap
        .replace(/\\\*&gt;/g, '>')
        .replace(/\\\\*&gt;/g, '>')
        .replace(/\\\*>/g, '>')
        .replace(/^\\&gt;/gm, '>')
        .replace(/^&gt;/gm, '>')
        // Global unescape of html entities that shouldn't be escaped in MD
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        // Fix weird list/blockquote interaction where Tiptap produces *> or *&gt;
        .replace(/^\*>/gm, '>')
        .replace(/^\*&gt;/gm, '>')
        // Normalize bare > to > with space
        .replace(/^>$/gm, '> ')
        // Fix blank lines between blockquotes (Tiptap serializes empty blockquote lines as blank)
        .replace(/(^>.*$)\n\n(^>)/gm, '$1\n> \n$2');
};

/**
 * Serializes the editor content to Markdown and applies custom sanitization
 * to fix common Tiptap serialization issues and ensure consistent formatting.
 * 
 * @param editor The Tiptap editor instance
 * @returns Sanitized Markdown string
 */
export const getSanitizedMarkdown = (editor: Editor): string => {
    let newContent = (editor.storage as any).markdown.getMarkdown();
    return sanitizeMarkdown(newContent);
};
