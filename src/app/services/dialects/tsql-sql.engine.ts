import { BaseSqlEngine, ParsedToken } from './base-sql.engine';
import { SqlDialect } from '../../models/sql-obfuscator.model';
import { ANSI_SQL_KEYWORDS } from './sql-keywords';

const TSQL_KEYWORDS = new Set([
    ...ANSI_SQL_KEYWORDS,
    'APPLY', 'BACKUP', 'BREAK', 'CHECKPOINT', 'CLUSTERED', 'CROSS APPLY',
    'DBCC', 'DISK', 'DUMP', 'FILE', 'FILLFACTOR', 'FREETEXT', 'FREETEXTTABLE',
    'HOLDLOCK', 'IDENTITY_INSERT', 'IDENTITYCOL', 'KILL', 'LINENO', 'LOAD',
    'NOCHECK', 'NONCLUSTERED', 'NOLOCK', 'OFFSETS', 'OPENDATASOURCE', 'OPENQUERY',
    'OPENROWSET', 'OPENXML', 'OUTER APPLY', 'OUTPUT', 'PERCENT', 'PIVOT', 'PRINT',
    'PROC', 'RAISERROR', 'READTEXT', 'RECONFIGURE', 'RESTORE', 'ROWCOUNT',
    'ROWGUIDCOL', 'SAVE', 'SECURITYAUDIT', 'SETUSER', 'SHUTDOWN', 'STATISTICS',
    'TEXTSIZE', 'TOP', 'TRAN', 'TSEQUAL', 'UNPIVOT', 'UPDATETEXT', 'WAITFOR', 'WRITETEXT'
]);

export class TSqlEngine extends BaseSqlEngine {
    readonly dialect: SqlDialect = 'tsql';
    readonly name = 'SQL Server (T-SQL)';
    readonly description = 'Brackets [tbl], N\'unicode\' strings, TOP / APPLY';

    protected getKeywords(): Set<string> {
        return TSQL_KEYWORDS;
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

            // T-SQL Bracket Quoted Identifiers [ident]
            if (ch === '[') {
                let ident = '[';
                i++;
                while (i < len) {
                    ident += sql[i];
                    if (sql[i] === ']') {
                        // Escaped closing bracket ]]
                        if (i + 1 < len && sql[i + 1] === ']') {
                            ident += sql[i + 1];
                            i += 2;
                            continue;
                        }
                        i++;
                        break;
                    }
                    i++;
                }
                tokens.push({ type: 'identifier', value: ident, quote: '[' });
                continue;
            }

            // String literals: N'...' (Unicode) and '...'
            if ((ch === 'N' || ch === 'n') && nextCh === "'") {
                let str = ch + "'";
                i += 2;
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

            // Unquoted Identifiers & Keywords (allows @local_var and #temp_table)
            if (/[a-zA-Z_@#]/.test(ch)) {
                let word = '';
                while (i < len && /[a-zA-Z0-9_$#@]/.test(sql[i])) {
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

