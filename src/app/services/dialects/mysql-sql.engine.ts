import { BaseSqlEngine, ParsedToken } from './base-sql.engine';
import { SqlDialect } from '../../models/sql-obfuscator.model';
import { ANSI_SQL_KEYWORDS } from './sql-keywords';

const MYSQL_KEYWORDS = new Set([
    ...ANSI_SQL_KEYWORDS,
    'AUTO_INCREMENT', 'BTREE', 'DATABASES', 'DELAYED', 'ENGINE', 'FORCE',
    'FULLTEXT', 'HASH', 'HIGH_PRIORITY', 'IGNORE', 'INDEX', 'KEYS', 'LIMIT',
    'LINES', 'LOAD', 'LOW_PRIORITY', 'OPTIMIZE', 'PURGE', 'QUICK', 'REGEXP',
    'REPLACE', 'RLIKE', 'SEPARATOR', 'SPATIAL', 'SQL_BIG_RESULT', 'SQL_BUFFER_RESULT',
    'SQL_CACHE', 'SQL_CALC_FOUND_ROWS', 'SQL_NO_CACHE', 'SQL_SMALL_RESULT',
    'SSL', 'STARTING', 'STRAIGHT_JOIN', 'TERMINATED', 'XOR'
]);

export class MySqlEngine extends BaseSqlEngine {
    readonly dialect: SqlDialect = 'mysql';
    readonly name = 'MySQL / MariaDB';
    readonly description = 'Backticks `tbl`, hash comments #, backslash escapes';

    protected getKeywords(): Set<string> {
        return MYSQL_KEYWORDS;
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

            // MySQL Hash Comment #
            if (ch === '#') {
                let comment = '';
                while (i < len && sql[i] !== '\n' && sql[i] !== '\r') {
                    comment += sql[i++];
                }
                tokens.push({ type: 'comment', value: comment });
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

            // Block comment /* */
            if (ch === '/' && nextCh === '*') {
                let comment = '/*';
                i += 2;
                while (i < len) {
                    comment += sql[i];
                    if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
                        comment += '/';
                        i += 2;
                        break;
                    }
                    i++;
                }
                tokens.push({ type: 'comment', value: comment });
                continue;
            }

            // Backtick Quoted Identifier `...`
            if (ch === '`') {
                let ident = '`';
                i++;
                while (i < len) {
                    ident += sql[i];
                    if (sql[i] === '`') {
                        // Escaped backtick ``
                        if (i + 1 < len && sql[i + 1] === '`') {
                            ident += sql[i + 1];
                            i += 2;
                            continue;
                        }
                        i++;
                        break;
                    }
                    i++;
                }
                tokens.push({ type: 'identifier', value: ident, quote: '`' });
                continue;
            }

            // String literals: MySQL supports '...' and "..."
            if (ch === "'" || ch === '"') {
                const quoteChar = ch;
                let str = quoteChar;
                i++;
                while (i < len) {
                    const c = sql[i];
                    // Backslash escape \' or \" or \\
                    if (c === '\\' && i + 1 < len) {
                        str += c + sql[i + 1];
                        i += 2;
                        continue;
                    }
                    if (c === quoteChar) {
                        str += quoteChar;
                        if (i + 1 < len && sql[i + 1] === quoteChar) {
                            str += sql[i + 1];
                            i += 2;
                            continue;
                        }
                        i++;
                        break;
                    }
                    str += c;
                    i++;
                }
                tokens.push({ type: 'string_literal', value: str, quote: quoteChar });
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

            // Symbols & operators
            tokens.push({ type: 'symbol', value: ch });
            i++;
        }

        return tokens;
    }
}

