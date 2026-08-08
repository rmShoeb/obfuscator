# Obfuscator
A browser-native, privacy-first tool designed to help developers, analysts, DBAs, support engineers, and technical teams safely share code and queries without exposing sensitive schema details, proprietary business logic, or personal data.

## Project Overview & Core Purpose
Sharing technical code, database queries, and diagnostics outside an organization, whether to external AI assistants, community forums, or third-party support vendors, presents significant security risks. Unsanitized code can leak internal identifiers, database schema structures, sensitive business logic, and actual data values.
Obfuscator provides a secure, interactive workspace to scrub sensitive information while preserving code structure and syntax. It operates entirely in browser memory and supports bi-directional mapping:
- **Obfuscation:** Converts sensitive table names, column identifiers, schema objects, inline comments, and string/numeric literals into standard placeholders (`tbl_1`, `col_1`, `'STR_1'`).
- **De-obfuscation:** Reverses sanitized output back to original identifiers using an active in-memory token registry, allowing teams to re-apply external feedback or fixes safely.

## Currently Supported
- Bi-directional transformation.
- Dual-pane code editors with syntax highlighting and line numbers.
- Syntax-aware token replacement and customizable masking rules (literals, identifiers, comments).
- Interactive Token Dictionary modal with JSON import/export options.
- **SQL Obfuscation:**
    - Multi-dialect support (PostgreSQL, MySQL, MariaDB, Oracle PL/SQL, Microsoft SQL Server T-SQL, SQLite, ANSI SQL.

## Future Plan
- Execution Plan Obfuscation: Masking sensitive node details, table scans, index names, raw costs, and row counts from database query execution plans (`EXPLAIN` / `EXPLAIN ANALYZE` outputs) while keeping execution tree structures intact
- Extensible Data Redaction: Future modules for sanitizing application logs, connection strings, and JSON/XML payloads.

## Security & Privacy Architecture
The security model of Obfuscator relies on strict client-side boundary isolation:
1. **Zero Network Telemetry**
    - *100% Client-Side Execution:* Obfuscator has no backend architecture and makes zero HTTP or API calls. All parsing, token replacement, and state retention occur strictly within the browser's JavaScript runtime memory.
    - *No External Analytics:* No tracking scripts, analytics, or logging endpoints are integrated into the application.
2. Transient Memory Lifetime
    - Mappings exist only during your active browser session.
    - Token dictionaries, schema names, and raw inputs are never written to `localStorage`, `sessionStorage`, or `IndexedDB`. Closing or refreshing the tab permanently purges all sensitive mappings from memory.
3. Structural Parsing Accuracy
    - Uses Abstract Syntax Tree (AST) parsing and language tokenization rather than fragile regular expressions. This ensures string literals containing reserved keywords (*e.g.*, `'WHERE street IS NOT NULL'`) are safely masked without corrupting syntax.