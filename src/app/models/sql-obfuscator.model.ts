export type SqlDialect = 'auto' | 'postgres' | 'mysql' | 'oracle' | 'tsql' | 'sqlite' | 'ansi';

export interface SqlDialectInfo {
    id: SqlDialect;
    name: string;
    description: string;
    quoteChar: string; // ` for mysql, [ ] for tsql, " for postgres/oracle/ansi
}

export interface SqlObfuscationOptions {
    dialect: SqlDialect;
    maskLiterals: boolean;
    maskIdentifiers: boolean;
    stripComments: boolean;
}

export const SUPPORTED_SQL_DIALECTS: SqlDialectInfo[] = [
    { id: 'auto', name: 'Auto-Detect', description: 'Automatically infer dialect syntax rules', quoteChar: 'Auto' },
    { id: 'postgres', name: 'PostgreSQL', description: 'Double quotes "tbl", dollar string literals $$lit$$', quoteChar: '"' },
    { id: 'mysql', name: 'MySQL / MariaDB', description: 'Backticks `tbl`, hash comments # comment', quoteChar: '`' },
    { id: 'tsql', name: 'SQL Server (T-SQL)', description: 'Brackets [tbl], N\'unicode\' strings', quoteChar: '[' },
    { id: 'oracle', name: 'Oracle PL/SQL', description: 'Double quotes "tbl", Q\'string\' syntax', quoteChar: '"' },
    { id: 'sqlite', name: 'SQLite', description: 'Double quotes "tbl", backticks `tbl`, brackets [tbl]', quoteChar: '"' },
    { id: 'ansi', name: 'ANSI SQL Standard', description: 'Standard double quote identifiers and single quote strings', quoteChar: '"' }
];

export const DEFAULT_SQL_OPTIONS: SqlObfuscationOptions = {
    dialect: 'auto',
    maskLiterals: true,
    maskIdentifiers: true,
    stripComments: true
};
