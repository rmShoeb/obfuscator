import { BaseSqlEngine, ParsedToken } from './base-sql.engine';
import { SqlDialect } from '../../models/sql-obfuscator.model';
import { ANSI_SQL_KEYWORDS } from './sql-keywords';

const POSTGRES_KEYWORDS = new Set([
    ...ANSI_SQL_KEYWORDS,
    'ANALYSE', 'CONCURRENTLY', 'FREEZE', 'ILIKE', 'ISNULL', 'NOTNULL',
    'PLACING', 'RETURNING', 'SIMILAR', 'TABLESPACE', 'VACUUM', 'VERBOSE',
    'WINDOW', 'DO', 'LISTEN', 'NOTIFY', 'REINDEX', 'OFFSET', 'LIMIT'
]);

export class PostgresSqlEngine extends BaseSqlEngine {
    readonly dialect: SqlDialect = 'postgres';
    readonly name = 'PostgreSQL';
    readonly description = 'Double quotes "tbl", dollar-quotes $$lit$$, E\'escape\' strings';

    protected getKeywords(): Set<string> {
        return POSTGRES_KEYWORDS;
    }

    tokenize(sql: string): ParsedToken[] {
        const tokens: ParsedToken[] = [];
        const len = sql.length;
        let i = 0;
        const keywords = this.getKeywords();

        while (i < len) {
            const ch = sql[i];
            const nextCh = i + 1 < len ? sql[i + 1] : '';

            // Whitespace
            if (/\s/.test(ch)) {
                let ws = '';
                while (i < len && /\s/.test(sql[i])) {
                    ws += sql[i++];
                }
                tokens.push({ type: 'whitespace', value: ws });
                continue;
            }

            // Single line comment --
            if (ch === '-' && nextCh === '-') {
                let comment = '';
                while (i < len && sql[i] !== '\n' && sql[i] !== '\r') {
                    comment += sql[i++];
                }
                tokens.push({ type: 'comment', value: comment });
                continue;
            }

            // Nested Block comment /* /* */ */
            if (ch === '/' && nextCh === '*') {
                let comment = '/*';
                i += 2;
                let depth = 1;
                while (i < len && depth > 0) {
                    if (sql[i] === '/' && i + 1 < len && sql[i + 1] === '*') {
                        comment += '/*';
                        i += 2;
                        depth++;
                        continue;
                    }
                    if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
                        comment += '*/';
                        i += 2;
                        depth--;
                        continue;
                    }
                    comment += sql[i++];
                }
                tokens.push({ type: 'comment', value: comment });
                continue;
            }

            // Dollar-quoted strings: $$...$$ or $tag$...$tag$
            if (ch === '$') {
                const dollarMatch = sql.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
                if (dollarMatch) {
                    const tag = dollarMatch[0]; // e.g. "$$" or "$tag$"
                    let str = tag;
                    i += tag.length;
                    const closeIndex = sql.indexOf(tag, i);
                    if (closeIndex !== -1) {
                        str += sql.slice(i, closeIndex + tag.length);
                        i = closeIndex + tag.length;
                    } else {
                        str += sql.slice(i);
                        i = len;
                    }
                    tokens.push({ type: 'string_literal', value: str, quote: tag });
                    continue;
                }
            }

            // Escape string constants: E'...' or e'...'
            if ((ch === 'E' || ch === 'e') && nextCh === "'") {
                let str = ch + "'";
                i += 2;
                while (i < len) {
                    const c = sql[i];
                    if (c === '\\' && i + 1 < len) {
                        str += c + sql[i + 1];
                        i += 2;
                        continue;
                    }
                    if (c === "'") {
                        str += "'";
                        if (i + 1 < len && sql[i + 1] === "'") {
                            str += "'";
                            i += 2;
                            continue;
                        }
                        i++;
                        break;
                    }
                    str += c;
                    i++;
                }
                tokens.push({ type: 'string_literal', value: str, quote: "'" });
                continue;
            }

            // Standard string literal '...'
            if (ch === "'") {
                let str = "'";
                i++;
                while (i < len) {
                    if (sql[i] === "'") {
                        str += "'";
                        if (i + 1 < len && sql[i + 1] === "'") {
                            str += "'";
                            i += 2;
                            continue;
                        }
                        i++;
                        break;
                    }
                    str += sql[i++];
                }
                tokens.push({ type: 'string_literal', value: str, quote: "'" });
                continue;
            }

            // Double Quoted Identifier "..."
            if (ch === '"') {
                let ident = '"';
                i++;
                while (i < len) {
                    ident += sql[i];
                    if (sql[i] === '"') {
                        // Escaped double quote ""
                        if (i + 1 < len && sql[i + 1] === '"') {
                            ident += sql[i + 1];
                            i += 2;
                            continue;
                        }
                        i++;
                        break;
                    }
                    i++;
                }
                tokens.push({ type: 'identifier', value: ident, quote: '"' });
                continue;
            }

            // Numeric literals
            if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(nextCh))) {
                let num = '';
                while (i < len && /[0-9.]/.test(sql[i])) {
                    num += sql[i++];
                }
                tokens.push({ type: 'numeric_literal', value: num });
                continue;
            }

            // Unquoted Identifiers & Keywords
            if (/[a-zA-Z_]/.test(ch)) {
                let word = '';
                while (i < len && /[a-zA-Z0-9_$]/.test(sql[i])) {
                    word += sql[i++];
                }
                if (keywords.has(word.toUpperCase())) {
                    tokens.push({ type: 'keyword', value: word });
                } else {
                    tokens.push({ type: 'identifier', value: word });
                }
                continue;
            }

            // Operators & Symbols (including :: cast, ->, ->>)
            tokens.push({ type: 'symbol', value: ch });
            i++;
        }

        return tokens;
    }
}

