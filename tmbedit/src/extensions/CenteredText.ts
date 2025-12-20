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
        return ['div', mergeAttributes(HTMLAttributes, { style: 'text-align: center' }), 0];
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
                    state.write('<div style="text-align: center">');
                    state.renderInline(node);
                    state.write('</div>');
                    state.closeBlock(node);
                },
                parse: {
                    setup(markdownit: any) {
                        markdownit.block.ruler.before('blockquote', 'centered_text', (state: any, startLine: number, _endLine: number, silent: boolean) => {
                            const start = state.bMarks[startLine] + state.tShift[startLine];
                            const max = state.eMarks[startLine];
                            const text = state.src.slice(start, max);

                            const match = text.match(/^>\s+(.+?)\s+<$/);
                            if (!match) return false;

                            if (silent) return true;

                            state.line = startLine + 1;

                            const tokenOpen = state.push('centered_open', 'div', 1);
                            tokenOpen.attrs = [['style', 'text-align: center']];

                            const tokenInline = state.push('inline', '', 0);
                            tokenInline.content = match[1];
                            tokenInline.children = [];

                            state.push('centered_close', 'div', -1);

                            return true;
                        });
                    },
                },
            },
        };
    },
});
