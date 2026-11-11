import { TokenMapping } from './obfuscator.interface';

export type SqlDialect = 'ansi' | 'mysql' | 'postgres' | 'tsql' | 'oracle' | 'sqlite';

export interface SqlDialectInfo {
    id: SqlDialect;
    name: string;
    description: string;
    quoteChar: string;
}

export interface SqlObfuscationOptions {
    dialect: SqlDialect;
    maskLiterals: boolean;
    maskIdentifiers: boolean;
    stripComments: boolean;
}

export const DEFAULT_SQL_DIALECT: SqlDialect = 'ansi';

export const SUPPORTED_SQL_DIALECTS: SqlDialectInfo[] = [
    { id: 'ansi', name: 'ANSI SQL (Default)', description: 'Standard ANSI SQL syntax ("ident" and \'literal\')', quoteChar: '"' },
    { id: 'mysql', name: 'MySQL / MariaDB', description: 'Backticks `tbl`, hash comments #, backslash escapes', quoteChar: '`' },
    { id: 'postgres', name: 'PostgreSQL', description: 'Double quotes "tbl", dollar-quotes $$lit$$, E\'escape\' strings', quoteChar: '"' },
    { id: 'tsql', name: 'SQL Server (T-SQL)', description: 'Brackets [tbl], N\'unicode\' strings, TOP / APPLY', quoteChar: '[' },
    { id: 'oracle', name: 'Oracle PL/SQL', description: 'Double quotes "tbl", Q\'string\' syntax, ROWNUM', quoteChar: '"' },
    { id: 'sqlite', name: 'SQLite', description: 'Double quotes "tbl", backticks `tbl`, brackets [tbl]', quoteChar: '"' }
];

export const DEFAULT_SQL_OPTIONS: SqlObfuscationOptions = {
    dialect: DEFAULT_SQL_DIALECT,
    maskLiterals: true,
    maskIdentifiers: true,
    stripComments: true
};

export interface ExportedMappingPackage {
    version: string;
    dialect: SqlDialect;
    exportedAt: string;
    mappings: TokenMapping[];
}
