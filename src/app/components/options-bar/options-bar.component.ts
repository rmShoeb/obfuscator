import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SqlObfuscationOptions } from '../../models/sql-obfuscator.model';
import { SUPPORTED_LANGUAGES, LanguageOption } from '../../models/language-config';

@Component({
    selector: 'app-options-bar',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule
    ],
    templateUrl: './options-bar.component.html',
    styleUrl: './options-bar.component.css',
})
export class OptionsBarComponent {
    readonly optionsChange = output<SqlObfuscationOptions>();
    readonly clearAll = output<void>();

    readonly languageOptions = signal<LanguageOption[]>(SUPPORTED_LANGUAGES);
    selectedOption = signal<string>(this.languageOptions()[0].id);

    onOptionChange(event: Event): void {
        const val = (event.target as HTMLSelectElement).value;
    }
    // readonly dialects = SUPPORTED_SQL_DIALECTS;

    // onDialectChange(event: Event): void {
    //     const val = (event.target as HTMLSelectElement).value as SqlDialect;
    //     this.optionsChange.emit({
    //         ...this.options(),
    //         dialect: val
    //     });
    // }
}
