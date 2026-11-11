import { BaseSqlEngine, ParsedToken } from './base-sql.engine';
import { SqlDialect } from '../../models/sql-obfuscator.model';
import { ANSI_SQL_KEYWORDS } from './sql-keywords';

const ORACLE_KEYWORDS = new Set([
    ...ANSI_SQL_KEYWORDS,
    'CONNECT_BY_ROOT', 'DECODE', 'EXCLUSIVE', 'IDENTIFIED', 'LOCK',
    'MINUS', 'MODE', 'NOAUDIT', 'NOCOMPRESS', 'NOWAIT', 'NUMBER',
    'NVL', 'NVL2', 'PLS_INTEGER', 'PRIOR', 'RAW', 'RECORD', 'ROWID',
    'ROWNUM', 'SHARE', 'START', 'SUCCESSFUL', 'SYNONYM', 'SYSDATE',
    'UID', 'VALIDATE', 'VARCHAR2'
]);

export class OracleSqlEngine extends BaseSqlEngine {
    readonly dialect: SqlDialect = 'oracle';
    readonly name = 'Oracle PL/SQL';
    readonly description = 'Double quotes "tbl", Q\'string\' syntax, ROWNUM';

    protected getKeywords(): Set<string> {
        return ORACLE_KEYWORDS;
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

            // Oracle Q-quote string literals: q'[...]' or Q'(...)'
            if ((ch === 'Q' || ch === 'q') && nextCh === "'" && i + 2 < len) {
                const openDelim = sql[i + 2];
                let closeDelim = openDelim;
                if (openDelim === '[') closeDelim = ']';
                else if (openDelim === '(') closeDelim = ')';
                else if (openDelim === '{') closeDelim = '}';
                else if (openDelim === '<') closeDelim = '>';

                const targetClose = closeDelim + "'";
                let str = ch + "'" + openDelim;
                i += 3;
                const closeIdx = sql.indexOf(targetClose, i);
                if (closeIdx !== -1) {
                    str += sql.slice(i, closeIdx + 2);
                    i = closeIdx + 2;
                } else {
                    str += sql.slice(i);
                    i = len;
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
                while (i < len && /[a-zA-Z0-9_$#]/.test(sql[i])) {
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

