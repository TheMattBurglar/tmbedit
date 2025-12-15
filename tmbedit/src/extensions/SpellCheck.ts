import { Extension } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { invoke } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';

export const SpellCheck = Extension.create({
    name: 'spellCheck',

    addOptions() {
        return {
            language: 'en_US',
            dictionaryPath: 'dictionaries', // Relative to resource path
        };
    },

    addStorage() {
        return {
            errorCount: 0,
            customWords: [] as string[],
            getSuggestions: (_word: string) => Promise.resolve([] as string[]),
            addWord: (_word: string) => { },
        }
    },

    onCreate() {
        const savedWords = localStorage.getItem('customDictionary');
        if (savedWords) {
            this.storage.customWords = JSON.parse(savedWords);
        }
    },

    addProseMirrorPlugins() {
        let errors: { word: string, index: number, length: number }[] = [];
        let isInitialized = false;

        return [
            new Plugin({
                key: new PluginKey('spellCheck'),
                state: {
                    init() {
                        return DecorationSet.empty;
                    },
                    apply(tr, oldState) {
                        return oldState.map(tr.mapping, tr.doc);
                    }
                },
                view: (view) => {
                    // Initialize Rust Backend
                    const initBackend = async () => {
                        try {
                            // Resolve absolute paths for dictionaries
                            let resourcePath = await resolveResource('dictionaries');

                            // Fix for Dev Mode: resolveResource points to target/debug/resources which might not exist yet
                            // or might not be populated in dev.
                            // We can try to detect if we are in dev?
                            // Or just pass the path and let Rust handle fallback?
                            // Let's pass the resource path we got.

                            const affPath = `${resourcePath}/${this.options.language}.aff`;
                            const dicPath = `${resourcePath}/${this.options.language}.dic`;

                            await invoke('init_spell_check', {
                                affPath,
                                dicPath,
                                customWords: this.storage.customWords
                            });

                            // Migration: Clear localStorage now that we've sent words to the backend
                            localStorage.removeItem('customDictionary');

                            isInitialized = true;
                            console.log("Rust SpellCheck initialized");

                            // Initial check
                            const { text } = extractTextWithMap(view.state.doc);
                            const result = await invoke<{ word: string, index: number, length: number }[]>('check_text', { text });
                            errors = result;
                            view.dispatch(view.state.tr.setMeta('spellCheckResult', true));

                        } catch (e) {
                            console.error("Failed to init Rust spell check:", e);
                        }
                    };

                    initBackend();

                    // Expose storage methods
                    this.storage.getSuggestions = async (word: string) => {
                        if (!isInitialized) return [];
                        try {
                            return await invoke<string[]>('get_suggestions', { word });
                        } catch (e) {
                            console.error("Failed to get suggestions:", e);
                            return [];
                        }
                    };

                    this.storage.addWord = async (word: string) => {
                        this.storage.customWords.push(word);
                        // localStorage persistence removed in favor of backend file storage

                        if (isInitialized) {
                            await invoke('add_custom_word', { word });
                            // Trigger re-check
                            const { text } = extractTextWithMap(view.state.doc);
                            const result = await invoke<{ word: string, index: number, length: number }[]>('check_text', { text });
                            errors = result;
                            view.dispatch(view.state.tr.setMeta('spellCheckResult', true));
                        }
                    };

                    return {
                        update: async (view, prevState) => {
                            const docChanged = !view.state.doc.eq(prevState.doc);

                            if (docChanged && isInitialized) {
                                const { text } = extractTextWithMap(view.state.doc);
                                try {
                                    const result = await invoke<{ word: string, index: number, length: number }[]>('check_text', { text });
                                    errors = result;
                                    view.dispatch(view.state.tr.setMeta('spellCheckResult', true));
                                } catch (e) {
                                    console.error("Check text failed:", e);
                                }
                            }
                        },
                        destroy: () => {
                            // Cleanup if needed
                        }
                    };
                },
                props: {
                    decorations: (state) => {
                        const { doc } = state;
                        const decos: Decoration[] = [];
                        let errorCount = 0;

                        if (errors.length > 0) {
                            const { map } = extractTextWithMap(doc);

                            errors.forEach(err => {
                                // Find the text node that contains this error
                                const mapping = map.find(m => err.index >= m.offset && err.index < m.offset + m.length);

                                if (mapping) {
                                    // Calculate relative position in the node
                                    const relativeStart = err.index - mapping.offset;
                                    const from = mapping.from + relativeStart;
                                    const to = from + err.length;

                                    // Ensure we don't go out of bounds of the node (in case of stale errors)
                                    if (to <= mapping.to) {
                                        decos.push(Decoration.inline(from, to, {
                                            class: 'spell-error',
                                            'data-word': err.word,
                                            'data-from': from.toString(),
                                            'data-to': to.toString(),
                                        }));
                                        errorCount++;
                                    }
                                }
                            });
                        }

                        this.storage.errorCount = errorCount;
                        return DecorationSet.create(doc, decos);
                    }
                }
            }),
        ];
    },
});

// Helper to extract text and map it to nodes
function extractTextWithMap(doc: any) {
    let text = "";
    const map: { from: number, to: number, offset: number, length: number }[] = [];

    doc.descendants((node: any, pos: number) => {
        if (node.isText) {
            map.push({
                from: pos,
                to: pos + node.nodeSize,
                offset: text.length,
                length: node.text.length
            });
            text += node.text;
        } else if (node.isBlock) {
            if (text.length > 0 && !text.endsWith('\n')) {
                text += "\n";
            }
        }
    });

    return { text, map };
}
