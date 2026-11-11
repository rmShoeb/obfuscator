# Obfuscator
A browser-native, privacy-first tool designed to help developers, analysts, DBAs, support engineers, and technical teams safely share code and queries without exposing sensitive schema details, proprietary business logic, or personal data.

## Project Overview & Core Purpose
Sharing technical code, database queries, and diagnostics outside an organization—whether to external AI assistants, community forums, or third-party support vendors—presents significant security risks. Unsanitized code can leak internal identifiers, database schema structures, sensitive business logic, and actual data values.

Obfuscator provides a secure, interactive workspace to scrub sensitive information while preserving code structure and syntax. It operates entirely in browser memory and supports bi-directional mapping:
- **Obfuscation:** Converts sensitive database names, table names, column identifiers, schema objects, inline comments, and string literals into standard placeholders (`db_1`, `tbl_1`, `col_1`, `'STR_1'`).
- **De-obfuscation:** Reverses sanitized output back to original identifiers using word-boundary-aware pattern substitution and an active in-memory token registry, allowing teams to re-apply external feedback or fixes safely.

## Supported SQL Dialects (Flavors)
Obfuscator implements a modular dialect-specific engine architecture. By default, **ANSI SQL** is selected:
- **ANSI SQL (Default):** Standard ANSI double-quote identifiers (`"tbl"`) and standard string literals (`'str'`).
- **MySQL / MariaDB:** Backtick identifiers (`` `tbl` ``), hash comments (`#`), standard and double-quoted strings, backslash character escapes (`\'`, `\"`, `\\`), and MySQL keywords.
- **PostgreSQL:** Double-quote identifiers, dollar-quoted string literals (`$$str$$` and `$tag$str$tag$`), escape string constants (`E'str'`), and nested block comments.
- **Microsoft SQL Server (T-SQL):** Square bracket identifiers (`[tbl]`), Unicode string literals (`N'str'`), and T-SQL keywords (`TOP`, `CROSS APPLY`, `NOLOCK`).
- **Oracle PL/SQL:** Double-quote identifiers, Q-quoted string literals (`q'[str]'`), and Oracle keywords (`ROWNUM`, `SYSDATE`).
- **SQLite:** Backtick, square bracket, and double-quote identifiers, standard single-quote strings, and SQLite keywords.

## Key Features
- **Multi-part Identifier Recognition:** Accurately classifies qualified identifiers based on clause context (e.g. `myDB.theTable` as `db_1.tbl_1`, `myDB.theTable.theColumn` as `db_1.tbl_1.col_1`, and `table.column` as `tbl_1.col_1`).
- **Bi-directional Transformation:** One-click obfuscation and safe, token-boundary-aware de-obfuscation.
- **Interactive Token Dictionary:** Categorized mapping view (Databases, Tables, Columns, Strings, Identifiers) with search, filter, and count metrics.
- **Dialect-Aware Import & Export:** Export active mappings as structured JSON including the selected SQL flavor; importing a mappings JSON automatically restores both the token dictionary and the dialect.
- **Dual-Pane Interface:** Fast, responsive Bootstrap 5 interface with clipboard copy, character counts, and quick clear actions.

## Security & Privacy Architecture
The security model of Obfuscator relies on strict client-side boundary isolation:
1. **Zero Network Telemetry**
   - *100% Client-Side Execution:* Obfuscator has no backend architecture and makes zero HTTP or API calls for data processing. All parsing, token replacement, and state retention occur strictly within the browser's JavaScript runtime memory.
   - *No External Analytics:* No tracking scripts, analytics, or logging endpoints are integrated into the application.
2. **Transient Memory Lifetime**
   - Mappings exist only during your active browser session.
   - Token dictionaries, schema names, and raw inputs are never written to `localStorage`, `sessionStorage`, or `IndexedDB`. Closing or refreshing the tab permanently purges all sensitive mappings from memory.
3. **Syntax-Aware Lexical Tokenization**
   - Uses specialized lexical state machines and clause-context tracking rather than fragile regular expressions. This ensures string literals containing reserved keywords (*e.g.*, `'WHERE street IS NOT NULL'`) are safely masked without corrupting query syntax.

## Future Plans
- **Execution Plan Obfuscation:** Masking sensitive node details, table scans, index names, raw costs, and row counts from database query execution plans (`EXPLAIN` / `EXPLAIN ANALYZE` outputs) while keeping execution tree structures intact.
- **JSON & Text Obfuscation:** Dedicated engines for scrubbing application logs, connection strings, and JSON/XML payloads.
