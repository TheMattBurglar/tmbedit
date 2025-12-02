declare module 'typo-js' {
    export default class Typo {
        constructor(dictionary?: string, affData?: string | null, wordsData?: string | null, settings?: any);
        check(word: string): boolean;
        suggest(word: string, limit?: number): string[];
        loaded: boolean;
    }
}
