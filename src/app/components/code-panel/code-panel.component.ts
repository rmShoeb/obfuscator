import { Component, input, output, computed, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafeHtml } from '@angular/platform-browser';

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

@Component({
    selector: 'app-code-panel',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './code-panel.component.html',
    styleUrl: './code-panel.component.css',
})
export class CodePanelComponent {
    readonly title = input<string>('SQL Editor');
    readonly subtitle = input<string>('Input');
    readonly code = input<string>('');
    readonly placeholder = input<string>('Paste or type SQL queries here...');
    readonly isObfuscated = input<boolean>(false);
    readonly codeChange = output<string>();
    readonly copied = signal<boolean>(false);

    @ViewChild('backdropRef') backdropRef!: ElementRef<HTMLDivElement>;
    @ViewChild('textareaRef') textareaRef!: ElementRef<HTMLTextAreaElement>;
    @ViewChild('gutterRef') gutterRef!: ElementRef<HTMLDivElement>;

    readonly lineNumbers = computed(() => {
        const text = this.code();
        const count = text ? text.split('\n').length : 1;
        return Array.from({ length: Math.max(count, 18) }, (_, i) => i + 1);
    });

    readonly lineCount = computed(() => {
        const text = this.code();
        return text ? text.split('\n').length : 0;
    });

    readonly charCount = computed(() => {
        return this.code() ? this.code().length : 0;
    });

    readonly highlightedHtml = computed<SafeHtml>(() => {
        const text = this.code();
        if (!text) return '';
        const html = this.renderSqlSyntax(text);
        return html;
    });

    onInput(event: Event): void {
        const val = (event.target as HTMLTextAreaElement).value;
        this.codeChange.emit(val);
    }

    onScroll(event: Event): void {
        const textarea = event.target as HTMLTextAreaElement;
        if (this.backdropRef) {
            this.backdropRef.nativeElement.scrollTop = textarea.scrollTop;
            this.backdropRef.nativeElement.scrollLeft = textarea.scrollLeft;
        }
        if (this.gutterRef) {
            this.gutterRef.nativeElement.scrollTop = textarea.scrollTop;
        }
    }

    copyCode(): void {
        const text = this.code();
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 2000);
        });
    }

    clearCode(): void {
        this.codeChange.emit('');
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private renderSqlSyntax(sql: string): string {
        let output = '';
        let i = 0;
        const len = sql.length;

        while (i < len) {
            const ch = sql[i];
            const nextCh = i + 1 < len ? sql[i + 1] : '';

            // Comments --
            if (ch === '-' && nextCh === '-') {
                let comment = '';
                while (i < len && sql[i] !== '\n' && sql[i] !== '\r') {
                    comment += sql[i];
                    i++;
                }
                output += `<span class="hl-cmt">${this.escapeHtml(comment)}</span>`;
                continue;
            }

            // MySQL Hash comments #
            if (ch === '#') {
                let comment = '';
                while (i < len && sql[i] !== '\n' && sql[i] !== '\r') {
                    comment += sql[i];
                    i++;
                }
                output += `<span class="hl-cmt">${this.escapeHtml(comment)}</span>`;
                continue;
            }

            // Block comments /* */
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
                output += `<span class="hl-cmt">${this.escapeHtml(comment)}</span>`;
                continue;
            }

            // Strings '...'
            if (ch === "'" || (ch === 'N' && nextCh === "'")) {
                let strVal = '';
                if (ch === 'N') {
                    strVal += 'N';
                    i++;
                }
                const quoteChar = sql[i];
                strVal += quoteChar;
                i++;
                while (i < len) {
                    if (sql[i] === quoteChar) {
                        strVal += sql[i];
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
                output += `<span class="hl-str">${this.escapeHtml(strVal)}</span>`;
                continue;
            }

            // Quoted Identifiers: `backticks`, [brackets], "quotes"
            if (ch === '`' || ch === '[' || ch === '"') {
                const closeChar = ch === '[' ? ']' : ch;
                let identVal = ch;
                i++;
                while (i < len) {
                    identVal += sql[i];
                    if (sql[i] === closeChar) {
                        i++;
                        break;
                    }
                    i++;
                }
                output += `<span class="hl-ident">${this.escapeHtml(identVal)}</span>`;
                continue;
            }

            // Numbers
            if (/[0-9]/.test(ch)) {
                let numStr = '';
                while (i < len && /[0-9\.]/.test(sql[i])) {
                    numStr += sql[i];
                    i++;
                }
                output += `<span class="hl-num">${this.escapeHtml(numStr)}</span>`;
                continue;
            }

            // Words (Identifiers, Keywords, Obfuscated Placeholders)
            if (/[a-zA-Z_]/.test(ch)) {
                let name = '';
                while (i < len && /[a-zA-Z0-9_$]/.test(sql[i])) {
                    name += sql[i];
                    i++;
                }

                const upperName = name.toUpperCase();

                // Obfuscated placeholder check (tbl_1, col_1, STR_1, id_1)
                if (/^(tbl|col|STR|id)_\d+$/.test(name)) {
                    output += `<span class="hl-obf">${this.escapeHtml(name)}</span>`;
                } else if (SQL_KEYWORDS.has(upperName)) {
                    output += `<span class="hl-kw">${this.escapeHtml(name)}</span>`;
                } else {
                    output += `<span class="hl-ident">${this.escapeHtml(name)}</span>`;
                }
                continue;
            }

            // Symbols / Whitespace / Newlines
            if (ch === '\n') {
                output += '\n';
            } else {
                output += this.escapeHtml(ch);
            }
            i++;
        }

        return output;
    }
}
