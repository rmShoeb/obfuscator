import { Component, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    SqlDialect,
    SqlObfuscationOptions,
    DEFAULT_SQL_OPTIONS
} from '../../models/sql-obfuscator.model';
import { SUPPORTED_LANGUAGES, LanguageOption } from '../../models/language-config';
import { SqlObfuscatorService } from '../../services/sql-obfuscator.service';

@Component({
    selector: 'app-options-bar',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule
    ],
    templateUrl: './options-bar.component.html',
    styleUrl: './options-bar.component.css'
})
export class OptionsBarComponent {
    private sqlService = inject(SqlObfuscatorService);

    readonly optionsChange = output<SqlObfuscationOptions>();
    readonly clearAll = output<void>();

    // Engine options
    readonly languageOptions = signal<LanguageOption[]>(SUPPORTED_LANGUAGES);
    readonly selectedEngine = signal<string>(this.languageOptions()[0].id);

    // SQL Dialects from service
    readonly dialects = this.sqlService.supportedDialects;
    readonly selectedDialect = this.sqlService.currentDialect;

    // Toggles
    readonly maskLiterals = signal<boolean>(DEFAULT_SQL_OPTIONS.maskLiterals);
    readonly maskIdentifiers = signal<boolean>(DEFAULT_SQL_OPTIONS.maskIdentifiers);
    readonly stripComments = signal<boolean>(DEFAULT_SQL_OPTIONS.stripComments);

    onDialectChange(event: Event): void {
        const val = (event.target as HTMLSelectElement).value as SqlDialect;
        this.sqlService.setDialect(val);
        this.emitOptions();
    }

    onToggleChange(): void {
        this.emitOptions();
    }

    private emitOptions(): void {
        this.optionsChange.emit({
            dialect: this.selectedDialect(),
            maskLiterals: this.maskLiterals(),
            maskIdentifiers: this.maskIdentifiers(),
            stripComments: this.stripComments()
        });
    }
}
