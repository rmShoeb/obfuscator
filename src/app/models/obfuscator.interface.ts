export type ObfuscatorType = 'sql' | 'json' | 'text';

export type TokenCategory = 'identifier' | 'string_literal' | 'numeric_literal' | 'comment' | 'keyword';

export interface TokenMapping {
    original: string;
    obfuscated: string;
    category: TokenCategory;
    count: number;
}

export interface ObfuscationResult {
    resultText: string;
    mappings: TokenMapping[];
    totalTokensMapped: number;
    executionTimeMs: number;
}

export interface ImportResult {
    success: boolean;
    count: number;
    error?: string;
}

export interface IObfuscatorEngine<TOptions = any> {
    readonly id: ObfuscatorType;
    readonly name: string;
    readonly description: string;

    obfuscate(input: string, options: TOptions): ObfuscationResult;
    deobfuscate(obfuscatedInput: string): string;
    getMappings(): TokenMapping[];
    exportMappings(): string;
    importMappings(jsonStr: string): ImportResult;
    clearMappings(): void;
}
