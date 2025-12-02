import Typo from 'typo-js';

let spellChecker: any = null;
let customWords: string[] = [];

// Define message types
type WorkerMessage =
    | { type: 'INIT'; payload: { language: string; dictionaryPath: string; customWords: string[] } }
    | { type: 'CHECK'; payload: { text: string } }
    | { type: 'SUGGEST'; payload: { word: string; id: string } }
    | { type: 'ADD'; payload: { word: string } };

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            await initSpellChecker(payload.language, payload.dictionaryPath, payload.customWords);
            break;
        case 'CHECK':
            if (spellChecker) {
                const errors = checkText(payload.text);
                self.postMessage({ type: 'CHECK_RESULT', payload: errors });
            }
            break;
        case 'SUGGEST':
            if (spellChecker) {
                const suggestions = spellChecker.suggest(payload.word);
                self.postMessage({ type: 'SUGGEST_RESULT', payload: { suggestions, id: payload.id } });
            }
            break;
        case 'ADD':
            customWords.push(payload.word);
            // Re-check logic could go here if we wanted to be fancy, but the main thread handles the UI update
            break;
    }
};

async function initSpellChecker(language: string, dictionaryPath: string, savedCustomWords: string[]) {
    try {
        customWords = savedCustomWords || [];
        const [affData, dicData] = await Promise.all([
            fetch(`${dictionaryPath}/${language}.aff`).then(res => res.text()),
            fetch(`${dictionaryPath}/${language}.dic`).then(res => res.text())
        ]);

        spellChecker = new Typo(language, affData, dicData);
        self.postMessage({ type: 'INIT_SUCCESS' });
    } catch (error) {
        console.error('Failed to initialize spell checker in worker:', error);
        self.postMessage({ type: 'INIT_ERROR', payload: String(error) });
    }
}

function checkText(text: string) {
    if (!text) return [];

    const regex = /\b\w+(?:['’]\w+)?\b/g;
    let match;
    const errors = [];

    while ((match = regex.exec(text)) !== null) {
        const word = match[0];

        if (customWords.includes(word)) continue;

        const normalizedWord = word.replace(/’/g, "'");

        if (!spellChecker.check(word) && !spellChecker.check(normalizedWord)) {
            errors.push({
                word,
                index: match.index,
                length: word.length
            });
        }
    }
    return errors;
}
