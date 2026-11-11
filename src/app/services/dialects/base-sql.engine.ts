import {
    IdentifierSubCategory,
    ImportResult,
    ObfuscationResult,
    TokenCategory,
    TokenMapping
} from '../../models/obfuscator.interface';
import {
    DEFAULT_SQL_OPTIONS,
    ExportedMappingPackage,
    SqlDialect,
    SqlObfuscationOptions
} from '../../models/sql-obfuscator.model';

export type TokenType =
    | 'whitespace'
    | 'comment'
    | 'keyword'
    | 'identifier'
    | 'string_literal'
    | 'numeric_literal'
    | 'symbol';

export interface ParsedToken {
    type: TokenType;
    value: string;
    quote?: string;
    subCategory?: IdentifierSubCategory;
}

export interface InternalMapping {
    original: string;
    obfuscated: string;
    category: TokenCategory;
    subCategory?: IdentifierSubCategory;
    count: number;
}

export abstract class BaseSqlEngine {
    abstract readonly dialect: SqlDialect;
    abstract readonly name: string;
    abstract readonly description: string;

    // Registries
    protected forwardMap = new Map<string, string>(); // category::original -> obfuscated
    protected reverseMap = new Map<string, string>(); // obfuscated -> original
    protected tokenDetails = new Map<string, InternalMapping>(); // category::original -> InternalMapping

    // Deterministic Counters
    protected dbCounter = 0;
    protected tableCounter = 0;
    protected columnCounter = 0;
    protected stringCounter = 0;
    protected identCounter = 0;

    /**
     * Dialect-specific tokenization
     */
    abstract tokenize(sql: string): ParsedToken[];

    /**
     * Keywords set for the dialect
     */
    protected abstract getKeywords(): Set<string>;

    /**
     * Executes obfuscation for the given SQL string
     */
    obfuscate(input: string, options: SqlObfuscationOptions = DEFAULT_SQL_OPTIONS): ObfuscationResult {
        const startTime = performance.now();
        if (!input || input.trim() === '') {
            return {
                resultText: '',
                mappings: this.getMappings(),
                totalTokensMapped: 0,
                executionTimeMs: 0
            };
        }

        const rawTokens = this.tokenize(input);
        const resolvedTokens = this.classifyDottedChains(rawTokens);

        let output = '';
        let tokensMappedCount = 0;

        for (const token of resolvedTokens) {
            if (token.type === 'whitespace') {
                output += token.value;
                continue;
            }

            if (token.type === 'comment') {
                if (!options.stripComments) {
                    output += token.value;
                }
                continue;
            }

            if (token.type === 'keyword' || token.type === 'symbol' || token.type === 'numeric_literal') {
                output += token.value;
                continue;
            }

            if (token.type === 'string_literal') {
                if (options.maskLiterals) {
                    const obf = this.getOrCreateMapping(token.value, 'string_literal', token.quote);
                    output += obf;
                    tokensMappedCount++;
                } else {
                    output += token.value;
                }
                continue;
            }

            if (token.type === 'identifier') {
                if (options.maskIdentifiers) {
                    const obf = this.getOrCreateMapping(token.value, 'identifier', token.quote, token.subCategory);
                    output += obf;
                    tokensMappedCount++;
                } else {
                    output += token.value;
                }
                continue;
            }

            output += token.value;
        }

        const executionTimeMs = Math.round(performance.now() - startTime);

        return {
            resultText: output,
            mappings: this.getMappings(),
            totalTokensMapped: tokensMappedCount,
            executionTimeMs
        };
    }

    /**
     * De-obfuscates text using precise boundary matching
     */
    deobfuscate(obfuscatedInput: string): string {
        if (!obfuscatedInput || obfuscatedInput.trim() === '') {
            return '';
        }

        if (this.reverseMap.size === 0) {
            return obfuscatedInput;
        }

        // Sort registered obfuscated tokens by length descending
        const registeredTokens = Array.from(this.reverseMap.keys()).sort((a, b) => b.length - a.length);

        if (registeredTokens.length === 0) {
            return obfuscatedInput;
        }

        // Separate delimited/quoted tokens from bare word tokens
        // e.g., 'STR_1', `tbl_1`, [tbl_1], "tbl_1" have delimiter boundaries
        // bare tokens like tbl_1, col_1, db_1, id_1 require word boundaries (\b)
        const patterns: string[] = [];
        for (const t of registeredTokens) {
            const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (/^[a-zA-Z0-9_]+$/.test(t)) {
                patterns.push(`\\b${escaped}\\b`);
            } else {
                patterns.push(escaped);
            }
        }

        const regex = new RegExp(patterns.join('|'), 'g');

        return obfuscatedInput.replace(regex, (matched) => {
            const original = this.reverseMap.get(matched);
            return original !== undefined ? original : matched;
        });
    }

    getMappings(): TokenMapping[] {
        return Array.from(this.tokenDetails.values()).map(m => ({
            original: m.original,
            obfuscated: m.obfuscated,
            category: m.category,
            subCategory: m.subCategory,
            count: m.count
        }));
    }

    exportMappings(): string {
        const pkg: ExportedMappingPackage = {
            version: '1.0',
            dialect: this.dialect,
            exportedAt: new Date().toISOString(),
            mappings: this.getMappings()
        };
        return JSON.stringify(pkg, null, 2);
    }

    importMappings(jsonStr: string): ImportResult {
        try {
            if (!jsonStr || jsonStr.trim() === '') {
                return { success: false, count: 0, error: 'JSON content is empty.' };
            }

            const parsed = JSON.parse(jsonStr);
            if (!parsed || typeof parsed !== 'object') {
                return { success: false, count: 0, error: 'Invalid JSON format.' };
            }

            let mappingsList: any[] | null = null;
            let detectedDialect: string | undefined = undefined;

            if (Array.isArray(parsed)) {
                mappingsList = parsed;
            } else if (parsed.mappings && Array.isArray(parsed.mappings)) {
                mappingsList = parsed.mappings;
                if (typeof parsed.dialect === 'string') {
                    detectedDialect = parsed.dialect;
                }
            }

            if (!mappingsList) {
                return { success: false, count: 0, error: 'JSON payload missing valid "mappings" list.' };
            }

            let importedCount = 0;
            for (const item of mappingsList) {
                if (item && typeof item.original === 'string' && typeof item.obfuscated === 'string') {
                    const orig = item.original;
                    const obf = item.obfuscated;
                    const cat = (item.category as TokenCategory) || 'identifier';
                    const subCat = (item.subCategory as IdentifierSubCategory) || undefined;
                    const count = typeof item.count === 'number' ? item.count : 1;

                    const key = this.getLookupKey(orig, cat);
                    this.forwardMap.set(key, obf);
                    this.reverseMap.set(obf, orig);
                    this.tokenDetails.set(key, {
                        original: orig,
                        obfuscated: obf,
                        category: cat,
                        subCategory: subCat,
                        count
                    });

                    this.syncCountersFromObfuscatedToken(obf);
                    importedCount++;
                }
            }

            return { success: true, count: importedCount, dialect: detectedDialect };
        } catch (err: any) {
            return { success: false, count: 0, error: `JSON Parse Error: ${err.message || err}` };
        }
    }

    clearMappings(): void {
        this.forwardMap.clear();
        this.reverseMap.clear();
        this.tokenDetails.clear();
        this.dbCounter = 0;
        this.tableCounter = 0;
        this.columnCounter = 0;
        this.stringCounter = 0;
        this.identCounter = 0;
    }

    protected getLookupKey(original: string, category: TokenCategory): string {
        return `${category}::${original.trim()}`;
    }

    protected getOrCreateMapping(
        originalToken: string,
        category: TokenCategory,
        quoteChar?: string,
        subCat?: IdentifierSubCategory
    ): string {
        const key = this.getLookupKey(originalToken, category);

        if (this.tokenDetails.has(key)) {
            const entry = this.tokenDetails.get(key)!;
            entry.count++;
            // If subCategory was updated to more specific (e.g. database or table), retain it
            if (subCat && (!entry.subCategory || entry.subCategory === 'generic')) {
                entry.subCategory = subCat;
            }
            return entry.obfuscated;
        }

        let generatedCore = '';

        if (category === 'string_literal') {
            this.stringCounter++;
            generatedCore = `STR_${this.stringCounter}`;
        } else {
            if (subCat === 'database') {
                this.dbCounter++;
                generatedCore = `db_${this.dbCounter}`;
            } else if (subCat === 'table') {
                this.tableCounter++;
                generatedCore = `tbl_${this.tableCounter}`;
            } else if (subCat === 'column') {
                this.columnCounter++;
                generatedCore = `col_${this.columnCounter}`;
            } else {
                this.identCounter++;
                generatedCore = `id_${this.identCounter}`;
            }
        }

        let obfuscatedToken = generatedCore;
        if (quoteChar === '`') obfuscatedToken = `\`${generatedCore}\``;
        else if (quoteChar === '[') obfuscatedToken = `[${generatedCore}]`;
        else if (quoteChar === '"') obfuscatedToken = `"${generatedCore}"`;
        else if (quoteChar === "'") obfuscatedToken = `'${generatedCore}'`;

        this.forwardMap.set(key, obfuscatedToken);
        this.reverseMap.set(obfuscatedToken, originalToken);
        this.tokenDetails.set(key, {
            original: originalToken,
            obfuscated: obfuscatedToken,
            category,
            subCategory: subCat,
            count: 1
        });

        return obfuscatedToken;
    }

    protected stripQuotes(val: string): string {
        if (
            (val.startsWith('`') && val.endsWith('`')) ||
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            return val.slice(1, -1);
        }
        if (val.startsWith('[') && val.endsWith(']')) {
            return val.slice(1, -1);
        }
        return val;
    }

    protected syncCountersFromObfuscatedToken(obf: string): void {
        const unquoted = this.stripQuotes(obf);
        const match = unquoted.match(/^(db|tbl|col|STR|id)_(\d+)$/);
        if (match) {
            const prefix = match[1];
            const num = parseInt(match[2], 10);
            if (!isNaN(num)) {
                if (prefix === 'db') this.dbCounter = Math.max(this.dbCounter, num);
                else if (prefix === 'tbl') this.tableCounter = Math.max(this.tableCounter, num);
                else if (prefix === 'col') this.columnCounter = Math.max(this.columnCounter, num);
                else if (prefix === 'STR') this.stringCounter = Math.max(this.stringCounter, num);
                else if (prefix === 'id') this.identCounter = Math.max(this.identCounter, num);
            }
        }
    }

    /**
     * Analyzes SQL query structure to accurately categorize dotted identifier chains
     * (e.g. database.table, database.table.column, table.column) and standalone identifiers.
     */
    protected classifyDottedChains(tokens: ParsedToken[]): ParsedToken[] {
        type ClauseContext = 'SELECT' | 'TABLE' | 'EXPRESSION' | 'OTHER';
        const contextStack: ClauseContext[] = ['OTHER'];

        const getContext = (): ClauseContext => contextStack[contextStack.length - 1];

        // First pass: locate dotted identifier sequences
        // A sequence looks like: [ident] [.] [ident] (optionally [.] [ident] or [.] [*])
        let i = 0;
        const total = tokens.length;

        while (i < total) {
            const tok = tokens[i];

            // Manage clause context
            if (tok.type === 'keyword') {
                const kw = tok.value.toUpperCase();
                if (['SELECT'].includes(kw)) {
                    contextStack[contextStack.length - 1] = 'SELECT';
                } else if (['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE', 'VIEW', 'TRUNCATE'].includes(kw)) {
                    contextStack[contextStack.length - 1] = 'TABLE';
                } else if (['WHERE', 'ON', 'HAVING', 'GROUP', 'ORDER', 'SET'].includes(kw)) {
                    contextStack[contextStack.length - 1] = 'EXPRESSION';
                }
            } else if (tok.type === 'symbol') {
                if (tok.value === '(') {
                    // Push current or child context
                    contextStack.push(getContext());
                } else if (tok.value === ')') {
                    if (contextStack.length > 1) {
                        contextStack.pop();
                    }
                }
            }

            if (tok.type === 'identifier') {
                // Collect dotted chain forward
                const chainIndices: number[] = [i];
                let lookAhead = i + 1;

                while (lookAhead < total) {
                    // Skip whitespaces/comments between dot and identifier
                    let j = lookAhead;
                    while (j < total && (tokens[j].type === 'whitespace' || tokens[j].type === 'comment')) {
                        j++;
                    }
                    if (j < total && tokens[j].type === 'symbol' && tokens[j].value === '.') {
                        // Found a dot, look for next identifier or wildcard
                        let k = j + 1;
                        while (k < total && (tokens[k].type === 'whitespace' || tokens[k].type === 'comment')) {
                            k++;
                        }
                        if (k < total && tokens[k].type === 'identifier') {
                            chainIndices.push(k);
                            lookAhead = k + 1;
                            continue;
                        } else if (k < total && tokens[k].type === 'symbol' && tokens[k].value === '*') {
                            // table.* or db.table.*
                            lookAhead = k + 1;
                            break;
                        }
                    }
                    break;
                }

                const chainLen = chainIndices.length;
                const currentCtx = getContext();

                if (chainLen === 1) {
                    // Standalone identifier
                    if (currentCtx === 'TABLE') {
                        tokens[chainIndices[0]].subCategory = 'table';
                    } else if (currentCtx === 'SELECT' || currentCtx === 'EXPRESSION') {
                        tokens[chainIndices[0]].subCategory = 'column';
                    } else {
                        tokens[chainIndices[0]].subCategory = 'generic';
                    }
                } else if (chainLen === 2) {
                    // 2-part chain:
                    // In TABLE context: database.table (e.g. myDB.theTable)
                    // In SELECT/EXPRESSION context: table.column (e.g. users.id)
                    if (currentCtx === 'TABLE') {
                        tokens[chainIndices[0]].subCategory = 'database';
                        tokens[chainIndices[1]].subCategory = 'table';
                    } else {
                        tokens[chainIndices[0]].subCategory = 'table';
                        tokens[chainIndices[1]].subCategory = 'column';
                    }
                } else if (chainLen >= 3) {
                    // 3-part or more chain:
                    // database.table.column or database.schema.table
                    if (currentCtx === 'TABLE') {
                        tokens[chainIndices[0]].subCategory = 'database';
                        for (let c = 1; c < chainLen - 1; c++) {
                            tokens[chainIndices[c]].subCategory = 'database';
                        }
                        tokens[chainIndices[chainLen - 1]].subCategory = 'table';
                    } else {
                        tokens[chainIndices[0]].subCategory = 'database';
                        for (let c = 1; c < chainLen - 1; c++) {
                            tokens[chainIndices[c]].subCategory = 'table';
                        }
                        tokens[chainIndices[chainLen - 1]].subCategory = 'column';
                    }
                }

                // Advance index past chain
                i = chainIndices[chainIndices.length - 1];
            }

            i++;
        }

        return tokens;
    }
}
