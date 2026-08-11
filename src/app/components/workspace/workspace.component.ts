import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodePanelComponent } from '../code-panel/code-panel.component';
import { MappingModalComponent } from '../mapping-modal/mapping-modal.component';
import { SqlObfuscatorService } from '../../services/sql-obfuscator.service';
import { SqlObfuscationOptions, DEFAULT_SQL_OPTIONS } from '../../models/sql-obfuscator.model';
import { OptionsBarComponent } from '../options-bar/options-bar.component';

@Component({
    selector: 'app-workspace',
    standalone: true,
    imports: [
        CommonModule,
        OptionsBarComponent,
        CodePanelComponent,
        MappingModalComponent
    ],
    templateUrl: './workspace.component.html',
    styleUrl: './workspace.component.css'
})
export class WorkspaceComponent {
    private sqlService = inject(SqlObfuscatorService);

    readonly originalCode = signal<string>('');
    readonly obfuscatedCode = signal<string>('');
    readonly sqlOptions = signal<SqlObfuscationOptions>(DEFAULT_SQL_OPTIONS);
    readonly isModalOpen = signal<boolean>(false);

    readonly activeMappings = this.sqlService.mappings;

    runObfuscate(): void {
        const raw = this.originalCode();
        if (!raw) return;

        const res = this.sqlService.obfuscate(raw, this.sqlOptions());
        this.obfuscatedCode.set(res.resultText);
    }

    runDeobfuscate(): void {
        const masked = this.obfuscatedCode();
        if (!masked) return;

        const restored = this.sqlService.deobfuscate(masked);
        this.originalCode.set(restored);
    }

    onClearAll(): void {
        this.originalCode.set('');
        this.obfuscatedCode.set('');
        this.sqlService.clearMappings();
        // Note: sqlOptions is NOT changed, preserving user-selected dialect & toggles
    }
}
