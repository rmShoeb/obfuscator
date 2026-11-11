import { Injectable, signal, computed } from '@angular/core';
import { IObfuscatorEngine, ImportResult, ObfuscationResult, TokenMapping } from '../models/obfuscator.interface';
import {
    SqlDialect,
    SqlObfuscationOptions,
    DEFAULT_SQL_OPTIONS,
    DEFAULT_SQL_DIALECT,
    SUPPORTED_SQL_DIALECTS,
    SqlDialectInfo
} from '../models/sql-obfuscator.model';
import {
    BaseSqlEngine,
    AnsiSqlEngine,
    MySqlEngine,
    PostgresSqlEngine,
    TSqlEngine,
    OracleSqlEngine,
    SqliteEngine
} from './dialects';

@Injectable({
    providedIn: 'root'
})
export class SqlObfuscatorService implements IObfuscatorEngine<SqlObfuscationOptions> {
    readonly id = 'sql';
    readonly name = 'SQL Obfuscator';
    readonly description = 'Bi-directional dialect-aware SQL masking for schemas, identifiers, and string literals.';

    // Registered Flavor Engines
    private readonly engines: Record<SqlDialect, BaseSqlEngine> = {
        ansi: new AnsiSqlEngine(),
        mysql: new MySqlEngine(),
        postgres: new PostgresSqlEngine(),
        tsql: new TSqlEngine(),
        oracle: new OracleSqlEngine(),
        sqlite: new SqliteEngine()
    };

    // Active Dialect Signal (Default is ANSI SQL)
    readonly currentDialect = signal<SqlDialect>(DEFAULT_SQL_DIALECT);
    readonly supportedDialects = signal<SqlDialectInfo[]>(SUPPORTED_SQL_DIALECTS);

    // Active Engine
    readonly activeEngine = computed(() => this.engines[this.currentDialect()]);

    // Reactive Mappings
    private readonly mappingsSignal = signal<TokenMapping[]>([]);
    readonly mappings = computed(() => this.mappingsSignal());
    readonly totalMappedTokens = computed(() => this.mappingsSignal().reduce((sum, m) => sum + m.count, 0));

    constructor() {}

    /**
     * Switch active SQL Flavor
     */
    setDialect(dialect: SqlDialect): void {
        if (this.engines[dialect] && this.currentDialect() !== dialect) {
            this.currentDialect.set(dialect);
            this.updateMappingsSignal();
        }
    }

    obfuscate(input: string, options?: SqlObfuscationOptions): ObfuscationResult {
        const opts = options ?? { ...DEFAULT_SQL_OPTIONS, dialect: this.currentDialect() };
        const result = this.activeEngine().obfuscate(input, opts);
        this.updateMappingsSignal();
        return result;
    }

    deobfuscate(obfuscatedInput: string): string {
        return this.activeEngine().deobfuscate(obfuscatedInput);
    }

    getMappings(): TokenMapping[] {
        return this.activeEngine().getMappings();
    }

    exportMappings(): string {
        return this.activeEngine().exportMappings();
    }

    importMappings(jsonStr: string): ImportResult {
        // Peek at JSON to check if it contains a dialect definition
        try {
            const parsed = JSON.parse(jsonStr);
            if (parsed && typeof parsed === 'object' && typeof parsed.dialect === 'string') {
                const targetDialect = parsed.dialect.toLowerCase() as SqlDialect;
                if (this.engines[targetDialect]) {
                    this.currentDialect.set(targetDialect);
                }
            }
        } catch {
            // Ignore parse errors here; handled inside engine.importMappings
        }

        const res = this.activeEngine().importMappings(jsonStr);
        this.updateMappingsSignal();
        return res;
    }

    clearMappings(): void {
        this.activeEngine().clearMappings();
        this.updateMappingsSignal();
    }

    private updateMappingsSignal(): void {
        this.mappingsSignal.set(this.activeEngine().getMappings());
    }
}
