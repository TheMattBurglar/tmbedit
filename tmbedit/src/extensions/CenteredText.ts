import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        centered: {
            toggleCentered: () => ReturnType;
        };
    }
}

export const CenteredText = Node.create({
    name: 'centered',

    group: 'block',

    content: 'inline*',

    parseHTML() {
        return [
            {
                tag: 'center',
            },
            {
                tag: 'div',
                getAttrs: (element: HTMLElement | string) => {
                    if (typeof element === 'string') return false;
                    return element.style.textAlign === 'center' ? null : false;
                },
            },
            {
                tag: 'p',
                getAttrs: (element: HTMLElement | string) => {
                    if (typeof element === 'string') return false;
                    return element.style.textAlign === 'center' ? null : false;
                },
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['center', mergeAttributes(HTMLAttributes), 0];
    },

    addCommands() {
        return {
            toggleCentered:
                () =>
                    ({ commands }) => {
                        return commands.toggleNode(this.name, 'paragraph');
                    },
        };
    },

    addStorage() {
        return {
            markdown: {
                serialize(state: any, node: any) {
                    state.write('<center>');
                    state.renderInline(node);
                    state.write('</center>');
                    state.closeBlock(node);
                },
                parse: {
                    setup(markdownit: any) {
                        // Handle the legacy custom syntax > text < for backward compatibility
                        markdownit.block.ruler.before('blockquote', 'centered_text_legacy', (state: any, startLine: number, _endLine: number, silent: boolean) => {
                            const start = state.bMarks[startLine] + state.tShift[startLine];
                            const max = state.eMarks[startLine];
                            const text = state.src.slice(start, max);

                            const match = text.match(/^>\s+(.+?)\s+<$/);
                            if (!match) return false;

                            if (silent) return true;

                            state.line = startLine + 1;

                            state.push('centered_open', 'center', 1);

                            const tokenInline = state.push('inline', '', 0);
                            tokenInline.content = match[1];
                            tokenInline.children = [];

                            state.push('centered_close', 'center', -1);

                            return true;
                        });

                        // Handle <center>...</center> blocks
                        markdownit.block.ruler.before('centered_text_legacy', 'centered_text_html', (state: any, startLine: number, _endLine: number, silent: boolean) => {
                            const start = state.bMarks[startLine] + state.tShift[startLine];
                            const max = state.eMarks[startLine];
                            const text = state.src.slice(start, max);

                            const match = text.match(/^<center>(.*?)<\/center>\s*$/i);
                            if (!match) return false;

                            if (silent) return true;

                            state.line = startLine + 1;

                            state.push('centered_open', 'center', 1);
                            const tokenInline = state.push('inline', '', 0);
                            tokenInline.content = match[1];
                            tokenInline.children = [];
                            state.push('centered_close', 'center', -1);

                            return true;
                        });
                    },
                },
            },
        };
    },
});
