import { Injectable, signal, computed } from '@angular/core';
import { IObfuscatorEngine, ImportResult, ObfuscationResult, TokenCategory, TokenMapping } from '../models/obfuscator.interface';
import { SqlDialect, SqlObfuscationOptions, DEFAULT_SQL_OPTIONS } from '../models/sql-obfuscator.model';

const SQL_KEYWORDS = new Set([
    'ABORT', 'ABS', 'ACTION', 'ADD', 'AFTER', 'ALL', 'ALTER', 'ALWAYS', 'ANALYZE', 'AND',
    'ANY', 'AS', 'ASC', 'ASSERTION', 'AT', 'AUTHORIZATION', 'AUTO_INCREMENT', 'AVG', 'BEFORE',
    'BEGIN', 'BETWEEN', 'BIGINT', 'BINARY', 'BIT', 'BLOB', 'BOOLEAN', 'BOTH', 'BY', 'CALL',
    'CASCADE', 'CASCADED', 'CASE', 'CAST', 'CHAR', 'CHARACTER', 'CHECK', 'CLOSE', 'COALESCE',
    'COLLATE', 'COLUMN', 'COMMENT', 'COMMIT', 'COMPUTE', 'CONSTRAINT', 'CONTAINS', 'CONTINUE',
    'CONVERT', 'COUNT', 'CREATE', 'CROSS', 'CUBE', 'CURRENT', 'CURRENT_DATE', 'CURRENT_TIME',
    'CURRENT_TIMESTAMP', 'CURRENT_USER', 'CURSOR', 'DATABASE', 'DATE', 'DATETIME', 'DAY',
    'DEC', 'DECIMAL', 'DECLARE', 'DEFAULT', 'DELETE', 'DENSE_RANK', 'DESC', 'DESCRIBE',
    'DETERMINISTIC', 'DISTINCT', 'DO', 'DOUBLE', 'DROP', 'EACH', 'ELSE', 'ELSEIF', 'END',
    'ENUM', 'ESCAPE', 'EXCEPT', 'EXEC', 'EXECUTE', 'EXISTS', 'EXIT', 'EXPLAIN', 'EXTRACT',
    'FALSE', 'FETCH', 'FLOAT', 'FOR', 'FOREIGN', 'FROM', 'FULL', 'FUNCTION', 'GENERATED',
    'GET', 'GLOBAL', 'GRANT', 'GROUP', 'GROUPING', 'HAVING', 'HOUR', 'IDENTITY', 'IF',
    'ILIKE', 'IN', 'INDEX', 'INNER', 'INOUT', 'INPUT', 'INSERT', 'INT', 'INTEGER',
    'INTERSECT', 'INTERVAL', 'INTO', 'IS', 'ISNULL', 'JOIN', 'KEY', 'LANGUAGE', 'LATERAL',
    'LEAD', 'LEFT', 'LIKE', 'LIMIT', 'LOCAL', 'LOWER', 'MATCH', 'MAX', 'MEDIUMINT',
    'MICROSECOND', 'MIN', 'MINUTE', 'MOD', 'MODIFY', 'MONTH', 'NATURAL', 'NCHAR', 'NEXT',
    'NO', 'NOT', 'NULL', 'NULLIF', 'NUMERIC', 'NVARCHAR', 'OF', 'OFFSET', 'ON', 'ONLY',
    'OPEN', 'OPTION', 'OR', 'ORDER', 'OUT', 'OUTER', 'OVER', 'PARTITION', 'PERCENT',
    'POSITION', 'PRECISION', 'PRIMARY', 'PROCEDURE', 'RANK', 'READ', 'REAL', 'RECURSIVE',
    'REFERENCES', 'REGEXP', 'RELEASE', 'RENAME', 'REPEAT', 'REPLACE', 'RESTRICT', 'RETURN',
    'RETURNS', 'REVOKE', 'RIGHT', 'ROLLBACK', 'ROLLUP', 'ROW', 'ROWS', 'ROW_NUMBER',
    'SCHEMA', 'SECOND', 'SELECT', 'SET', 'SHOW', 'SMALLINT', 'SOME', 'START', 'SUBSTRING',
    'SUM', 'SYS', 'TABLE', 'THEN', 'TIME', 'TIMESTAMP', 'TINYINT', 'TO', 'TOP', 'TRAN',
    'TRANSACTION', 'TRIGGER', 'TRIM', 'TRUE', 'TRUNCATE', 'TYPE', 'UNION', 'UNIQUE',
    'UNKNOWN', 'UNNEST', 'UPDATE', 'UPPER', 'USE', 'USER', 'USING', 'VALUE', 'VALUES',
    'VARCHAR', 'VARYING', 'VIEW', 'WHEN', 'WHERE', 'WHILE', 'WINDOW', 'WITH', 'WORK',
    'YEAR', 'ZONE'
]);

interface InternalMapping {
    original: string;
    obfuscated: string;
    category: TokenCategory;
    count: number;
}

interface ParsedToken {
    type: 'whitespace' | 'comment' | 'keyword' | 'identifier' | 'string_literal' | 'numeric_literal' | 'symbol';
    value: string;
    quote?: string;
    subCategory?: 'table' | 'column' | 'generic';
}



@Injectable({
    providedIn: 'root'
})
export class SqlObfuscatorService implements IObfuscatorEngine<SqlObfuscationOptions> {
    readonly id = 'sql';
    readonly name = 'SQL Obfuscator';
    readonly description = 'Bi-directional SQL dialect masking for schemas, identifiers, and string literals.';

    // In-memory token registries
    private forwardMap = new Map<string, string>(); // Key (normalized) -> Obfuscated Token
    private reverseMap = new Map<string, string>(); // Obfuscated Token -> Original Token
    private tokenDetails = new Map<string, InternalMapping>(); // Key -> InternalMapping

    // Counter state for deterministic placeholder generation
    private tableCounter = 0;
    private columnCounter = 0;
    private stringCounter = 0;
    private identCounter = 0;

    // Signal for reactive mapping dictionary view
    private readonly mappingsSignal = signal<TokenMapping[]>([]);
    readonly mappings = computed(() => this.mappingsSignal());
    readonly totalMappedTokens = computed(() => this.mappingsSignal().reduce((sum, m) => sum + m.count, 0));

    constructor() { }

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

        const tokens = this.tokenizeSql(input, options.dialect);
        let output = '';
        let tokensMappedCount = 0;

        for (const token of tokens) {
            if (token.type === 'whitespace') {
                output += token.value;
                continue;
            }

            if (token.type === 'comment') {
                if (options.stripComments) {
                    // Remove comment
                    continue;
                } else {
                    output += token.value;
                    continue;
                }
            }

            if (token.type === 'keyword' || token.type === 'symbol' || token.type === 'numeric_literal') {
                // Numbers, keywords, and symbols remain intact (e.g. LIMIT 1 remains LIMIT 1)
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

        this.updateMappingsSignal();
        const executionTimeMs = Math.round(performance.now() - startTime);

        return {
            resultText: output,
            mappings: this.getMappings(),
            totalTokensMapped: tokensMappedCount,
            executionTimeMs
        };
    }

    deobfuscate(obfuscatedInput: string): string {
        if (!obfuscatedInput || obfuscatedInput.trim() === '') {
            return '';
        }

        if (this.reverseMap.size === 0) {
            return obfuscatedInput;
        }

        // Sort registered obfuscated tokens by length descending so longer tokens match first
        const registeredTokens = Array.from(this.reverseMap.keys()).sort((a, b) => b.length - a.length);

        if (registeredTokens.length === 0) {
            return obfuscatedInput;
        }

        // Escape regex characters in obfuscated placeholders
        const patternStr = registeredTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const regex = new RegExp(patternStr, 'g');

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
            count: m.count
        }));
    }

    exportMappings(): string {
        const exportData = {
            app: 'SQL-Obfuscator-Studio',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            mappings: this.getMappings()
        };
        return JSON.stringify(exportData, null, 2);
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

            const mappingsList: any[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.mappings) ? parsed.mappings : null);

            if (!mappingsList) {
                return { success: false, count: 0, error: 'JSON payload missing valid "mappings" array structure.' };
            }

            let importedCount = 0;
            for (const item of mappingsList) {
                if (item && typeof item.original === 'string' && typeof item.obfuscated === 'string') {
                    const orig = item.original;
                    const obf = item.obfuscated;
                    const cat = (item.category as TokenCategory) || 'identifier';
                    const count = typeof item.count === 'number' ? item.count : 1;

                    const key = this.getLookupKey(orig, cat);
                    this.forwardMap.set(key, obf);
                    this.reverseMap.set(obf, orig);
                    this.tokenDetails.set(key, { original: orig, obfuscated: obf, category: cat, count });

                    this.syncCountersFromObfuscatedToken(obf, cat);

                    importedCount++;
                }
            }

            this.updateMappingsSignal();
            return { success: true, count: importedCount };
        } catch (err: any) {
            return { success: false, count: 0, error: `JSON Parse Error: ${err.message || err}` };
        }
    }

    clearMappings(): void {
        this.forwardMap.clear();
        this.reverseMap.clear();
        this.tokenDetails.clear();
        this.tableCounter = 0;
        this.columnCounter = 0;
        this.stringCounter = 0;
        this.identCounter = 0;
        this.updateMappingsSignal();
    }

    private getLookupKey(original: string, category: TokenCategory): string {
        return `${category}::${original.trim()}`;
    }

    private getOrCreateMapping(originalToken: string, category: TokenCategory, quoteChar?: string, subCat?: string): string {
        const key = this.getLookupKey(originalToken, category);

        if (this.tokenDetails.has(key)) {
            const entry = this.tokenDetails.get(key)!;
            entry.count++;
            return entry.obfuscated;
        }

        let generatedCore = '';

        if (category === 'string_literal') {
            this.stringCounter++;
            generatedCore = `STR_${this.stringCounter}`;
        } else {
            if (subCat === 'table') {
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

        // Apply quote wrapping if original token was quoted
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
            count: 1
        });

        return obfuscatedToken;
    }

    private stripQuotes(val: string): string {
        if ((val.startsWith('`') && val.endsWith('`')) ||
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
            return val.slice(1, -1);
        }
        if (val.startsWith('[') && val.endsWith(']')) {
            return val.slice(1, -1);
        }
        return val;
    }

    private syncCountersFromObfuscatedToken(obf: string, cat: TokenCategory): void {
        const unquoted = this.stripQuotes(obf);
        const match = unquoted.match(/^(tbl|col|STR|id)_(\d+)$/);
        if (match) {
            const prefix = match[1];
            const num = parseInt(match[2], 10);
            if (!isNaN(num)) {
                if (prefix === 'tbl') this.tableCounter = Math.max(this.tableCounter, num);
                else if (prefix === 'col') this.columnCounter = Math.max(this.columnCounter, num);
                else if (prefix === 'STR') this.stringCounter = Math.max(this.stringCounter, num);
                else if (prefix === 'id') this.identCounter = Math.max(this.identCounter, num);
            }
        }
    }

    private updateMappingsSignal(): void {
        this.mappingsSignal.set(this.getMappings());
    }

    // --- SQL Tokenizer Engine ---
    private tokenizeSql(sql: string, dialect: SqlDialect): ParsedToken[] {
        const tokens: ParsedToken[] = [];
        let i = 0;
        const len = sql.length;

        let previousToken: ParsedToken | null = null;

        while (i < len) {
            const ch = sql[i];
            const nextCh = i + 1 < len ? sql[i + 1] : '';

            // Whitespace
            if (/\s/.test(ch)) {
                let ws = '';
                while (i < len && /\s/.test(sql[i])) {
                    ws += sql[i];
                    i++;
                }
                tokens.push({ type: 'whitespace', value: ws });
                continue;
            }

            // Single line comments --
            if (ch === '-' && nextCh === '-') {
                let comment = '';
                while (i < len && sql[i] !== '\n' && sql[i] !== '\r') {
                    comment += sql[i];
                    i++;
                }
                const tok: ParsedToken = { type: 'comment', value: comment };
                tokens.push(tok);
                previousToken = tok;
                continue;
            }

            // MySQL Hash Comments #
            if (ch === '#' && (dialect === 'mysql' || dialect === 'auto')) {
                let comment = '';
                while (i < len && sql[i] !== '\n' && sql[i] !== '\r') {
                    comment += sql[i];
                    i++;
                }
                const tok: ParsedToken = { type: 'comment', value: comment };
                tokens.push(tok);
                previousToken = tok;
                continue;
            }

            // Block Comments /* */
            if (ch === '/' && nextCh === '*') {
                let comment = '';
                while (i < len) {
                    comment += sql[i];
                    if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
                        comment += '/';
                        i += 2;
                        break;
                    }
                    i++;
                }
                const tok: ParsedToken = { type: 'comment', value: comment };
                tokens.push(tok);
                previousToken = tok;
                continue;
            }

            // String Literals '...'
            if (ch === "'" || (ch === 'N' && nextCh === "'")) {
                let strVal = '';
                if (ch === 'N') {
                    strVal += 'N';
                    i++;
                }
                const quoteChar = sql[i];
                strVal += quoteChar;
                i++; // skip opening quote

                while (i < len) {
                    if (sql[i] === quoteChar) {
                        strVal += sql[i];
                        // Handle escaped quote ''
                        if (i + 1 < len && sql[i + 1] === quoteChar) {
                            strVal += sql[i + 1];
                            i += 2;
                            continue;
                        }
                        i++;
                        break;
                    }
                    strVal += sql[i];
                    i++;
                }
                const tok: ParsedToken = { type: 'string_literal', value: strVal, quote: quoteChar };
                tokens.push(tok);
                previousToken = tok;
                continue;
            }

            // Quoted Identifiers: MySQL `backtick`
            if (ch === '`') {
                let identVal = '`';
                i++;
                while (i < len) {
                    identVal += sql[i];
                    if (sql[i] === '`') {
                        i++;
                        break;
                    }
                    i++;
                }
                const subCat = this.inferIdentifierSubcategory(previousToken, tokens);
                const tok: ParsedToken = { type: 'identifier', value: identVal, quote: '`', subCategory: subCat };
                tokens.push(tok);
                previousToken = tok;
                continue;
            }

            // Quoted Identifiers: T-SQL [bracket]
            if (ch === '[' && (dialect === 'tsql' || dialect === 'sqlite' || dialect === 'auto')) {
                let identVal = '[';
                i++;
                while (i < len) {
                    identVal += sql[i];
                    if (sql[i] === ']') {
                        i++;
                        break;
                    }
                    i++;
                }
                const subCat = this.inferIdentifierSubcategory(previousToken, tokens);
                const tok: ParsedToken = { type: 'identifier', value: identVal, quote: '[', subCategory: subCat };
                tokens.push(tok);
                previousToken = tok;
                continue;
            }

            // Quoted Identifiers: Double Quotes "ident"
            if (ch === '"') {
                let identVal = '"';
                i++;
                while (i < len) {
                    identVal += sql[i];
                    if (sql[i] === '"') {
                        i++;
                        break;
                    }
                    i++;
                }
                const subCat = this.inferIdentifierSubcategory(previousToken, tokens);
                const tok: ParsedToken = { type: 'identifier', value: identVal, quote: '"', subCategory: subCat };
                tokens.push(tok);
                previousToken = tok;
                continue;
            }

            // Numeric Literals
            if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(nextCh))) {
                let numStr = '';
                while (i < len && /[0-9\.]/.test(sql[i])) {
                    numStr += sql[i];
                    i++;
                }
                const tok: ParsedToken = { type: 'numeric_literal', value: numStr };
                tokens.push(tok);
                previousToken = tok;
                continue;
            }

            // Unquoted Identifiers & Keywords
            if (/[a-zA-Z_]/.test(ch)) {
                let name = '';
                while (i < len && /[a-zA-Z0-9_$]/.test(sql[i])) {
                    name += sql[i];
                    i++;
                }

                const upperName = name.toUpperCase();
                if (SQL_KEYWORDS.has(upperName)) {
                    const tok: ParsedToken = { type: 'keyword', value: name };
                    tokens.push(tok);
                    previousToken = tok;
                } else {
                    const subCat = this.inferIdentifierSubcategory(previousToken, tokens);
                    const tok: ParsedToken = { type: 'identifier', value: name, subCategory: subCat };
                    tokens.push(tok);
                    previousToken = tok;
                }
                continue;
            }

            // Operators & Symbols
            tokens.push({ type: 'symbol', value: ch });
            previousToken = { type: 'symbol', value: ch };
            i++;
        }

        return tokens;
    }

    private inferIdentifierSubcategory(prevToken: ParsedToken | null, tokens: ParsedToken[]): 'table' | 'column' | 'generic' {
        if (!prevToken) return 'generic';

        let j = tokens.length - 1;
        while (j >= 0 && (tokens[j].type === 'whitespace' || tokens[j].type === 'comment')) {
            j--;
        }

        if (j >= 0) {
            const prev = tokens[j];
            if (prev.type === 'keyword') {
                const kw = prev.value.toUpperCase();
                if (['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE', 'VIEW'].includes(kw)) {
                    return 'table';
                }
                if (['SELECT', 'WHERE', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'SET'].includes(kw)) {
                    return 'column';
                }
            }
            if (prev.type === 'symbol' && (prev.value === '.' || prev.value === ',')) {
                return 'column';
            }
        }

        return 'generic';
    }
}
