import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SqlDialect, SqlObfuscationOptions, SUPPORTED_SQL_DIALECTS, DEFAULT_SQL_OPTIONS } from '../../models/sql-obfuscator.model';

@Component({
    selector: 'app-sql-options-bar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './sql-options-bar.component.html',
    styleUrl: './sql-options-bar.component.css',
})
export class SqlOptionsBarComponent {
    readonly options = input<SqlObfuscationOptions>(DEFAULT_SQL_OPTIONS);
    readonly mappingCount = input<number>(0);

    readonly optionsChange = output<SqlObfuscationOptions>();
    readonly openMappingModal = output<void>();
    readonly clearAll = output<void>();

    readonly dialects = SUPPORTED_SQL_DIALECTS;

    onDialectChange(event: Event): void {
        const val = (event.target as HTMLSelectElement).value as SqlDialect;
        this.optionsChange.emit({
            ...this.options(),
            dialect: val
        });
    }

    toggleOption(key: keyof Omit<SqlObfuscationOptions, 'dialect'>): void {
        const current = this.options();
        this.optionsChange.emit({
            ...current,
            [key]: !current[key]
        });
    }
}
