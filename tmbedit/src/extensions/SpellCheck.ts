import { Extension } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import { invoke } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';

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
        } else if (node.isInline) {
            // Handle inline non-text nodes (HardBreak, Image, etc.) to prevent offset drift
            if (node.type.name === 'hardBreak') {
                text += "\n";
            } else {
                // For other inline nodes (e.g. image), add a placeholder space
                // This ensures the JS string index advances by 1, matching the doc position advance (usually 1)
                text += " ";
            }
        }
    });

    return { text, map };
}

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
        let isInitialized = false;
        let debounceTimeout: any;
        let requestIdCounter = 0;
        const pluginKey = new PluginKey('spellCheck');

        return [
            new Plugin({
                key: pluginKey,
                state: {
                    init() {
                        return {
                            decorations: DecorationSet.empty,
                            pendingRequests: new Map<string, Mapping>(),
                        };
                    },
                    apply(tr, oldState) {
                        let { decorations, pendingRequests } = oldState;

                        // 1. Efficiently map existing decorations to new positions
                        decorations = decorations.map(tr.mapping, tr.doc);

                        // 2. Map pending requests
                        const newPendingRequests = new Map(pendingRequests);
                        if (tr.docChanged) {
                            newPendingRequests.forEach((mapping, id) => {
                                const newMapping = mapping.slice(0);
                                tr.steps.forEach(step => newMapping.appendMap(step.getMap()));
                                newPendingRequests.set(id, newMapping);
                            });
                        }

                        // 3. Handle Start
                        const startId = tr.getMeta('spellCheckStart');
                        if (startId) {
                            newPendingRequests.set(startId, new Mapping());
                        }

                        // 4. Handle Result
                        const result = tr.getMeta('spellCheckResult');
                        if (result) {
                            const { id, errors, textMap } = result;
                            const mapping = newPendingRequests.get(id);

                            if (mapping) {
                                newPendingRequests.delete(id);
                                const decos: Decoration[] = [];

                                errors.forEach((err: { word: string, index: number, length: number }) => {
                                    // 1. Find position in ORIGINAL text (when check started)
                                    const mappingEntry = textMap.find((m: any) => err.index >= m.offset && err.index < m.offset + m.length);
                                    if (mappingEntry) {
                                        const relativeStart = err.index - mappingEntry.offset;
                                        const originalFrom = mappingEntry.from + relativeStart;
                                        const originalTo = originalFrom + err.length;

                                        // 2. Map position to CURRENT document
                                        // We map both start and end to handle insertions effectively
                                        const from = mapping.map(originalFrom);
                                        const to = mapping.map(originalTo);

                                        // Ensure the decoration is still valid and has length
                                        if (to > from) {
                                            decos.push(Decoration.inline(from, to, {
                                                class: 'spell-error',
                                                'data-word': err.word,
                                                'data-from': from.toString(),
                                                'data-to': to.toString(),
                                            }));
                                        }
                                    }
                                });

                                decorations = DecorationSet.create(tr.doc, decos);
                            }
                        }

                        return { decorations, pendingRequests: newPendingRequests };
                    }
                },
                props: {
                    decorations(state) {
                        return pluginKey.getState(state)?.decorations;
                    },
                },
                view: (view) => {
                    const initBackend = async () => {
                        try {
                            let resourcePath = await resolveResource('dictionaries');
                            const affPath = `${resourcePath}/${this.options.language}.aff`;
                            const dicPath = `${resourcePath}/${this.options.language}.dic`;

                            await invoke('init_spell_check', {
                                affPath,
                                dicPath,
                                customWords: this.storage.customWords
                            });

                            localStorage.removeItem('customDictionary');
                            isInitialized = true;
                            console.log("Rust SpellCheck initialized");

                            // Initial check
                            const requestId = (requestIdCounter++).toString();
                            const { text, map } = extractTextWithMap(view.state.doc);
                            view.dispatch(view.state.tr.setMeta('spellCheckStart', requestId));

                            const result = await invoke<{ word: string, index: number, length: number }[]>('check_text', { text });
                            view.dispatch(view.state.tr.setMeta('spellCheckResult', { id: requestId, errors: result, textMap: map }));
                            this.storage.errorCount = result.length;

                        } catch (e) {
                            console.error("Failed to init Rust spell check:", e);
                        }
                    };

                    initBackend();

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
                        if (isInitialized) {
                            await invoke('add_custom_word', { word });
                            await invoke('add_custom_word', { word });
                            const requestId = (requestIdCounter++).toString();
                            const { text, map } = extractTextWithMap(view.state.doc);
                            view.dispatch(view.state.tr.setMeta('spellCheckStart', requestId));

                            const result = await invoke<{ word: string, index: number, length: number }[]>('check_text', { text });
                            view.dispatch(view.state.tr.setMeta('spellCheckResult', { id: requestId, errors: result, textMap: map }));
                            this.storage.errorCount = result.length;
                        }
                    };

                    return {
                        update: async (view, prevState) => {
                            const docChanged = !view.state.doc.eq(prevState.doc);

                            if (docChanged && isInitialized) {
                                if (debounceTimeout) clearTimeout(debounceTimeout);

                                debounceTimeout = setTimeout(async () => {
                                    const requestId = (requestIdCounter++).toString();
                                    const { text, map } = extractTextWithMap(view.state.doc);

                                    // Start tracking changes for this request
                                    view.dispatch(view.state.tr.setMeta('spellCheckStart', requestId));

                                    try {
                                        const result = await invoke<{ word: string, index: number, length: number }[]>('check_text', { text });
                                        view.dispatch(view.state.tr.setMeta('spellCheckResult', { id: requestId, errors: result, textMap: map }));
                                        this.storage.errorCount = result.length;
                                    } catch (e) {
                                        console.error("Check text failed:", e);
                                    }
                                }, 500);
                            }
                        },
                        destroy: () => {
                            if (debounceTimeout) clearTimeout(debounceTimeout);
                        }
                    };
                },
            }),
        ];
    },
});
