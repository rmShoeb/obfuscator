import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SqlOptionsBarComponent } from '../sql-options-bar/sql-options-bar.component';
import { CodePanelComponent } from '../code-panel/code-panel.component';
import { MappingModalComponent } from '../mapping-modal/mapping-modal.component';
import { SqlObfuscatorService } from '../../services/sql-obfuscator.service';
import { SqlObfuscationOptions, DEFAULT_SQL_OPTIONS } from '../../models/sql-obfuscator.model';

@Component({
    selector: 'app-workspace',
    standalone: true,
    imports: [
        CommonModule,
        SqlOptionsBarComponent,
        CodePanelComponent,
        MappingModalComponent
    ],
    templateUrl: './workspace.component.html',
    styleUrl: './workspace.component.css'
})
export class WorkspaceComponent {
    private sqlService = inject(SqlObfuscatorService);

    readonly originalSql = signal<string>('');
    readonly obfuscatedSql = signal<string>('');

    readonly sqlOptions = signal<SqlObfuscationOptions>(DEFAULT_SQL_OPTIONS);
    readonly isModalOpen = signal<boolean>(false);

    readonly activeMappings = this.sqlService.mappings;

    readonly lastExecStats = signal<{ timeMs: number; tokensMapped: number } | null>(null);

    runObfuscate(): void {
        const raw = this.originalSql();
        if (!raw) return;

        const res = this.sqlService.obfuscate(raw, this.sqlOptions());
        this.obfuscatedSql.set(res.resultText);
        this.lastExecStats.set({
            timeMs: res.executionTimeMs,
            tokensMapped: res.totalTokensMapped
        });
    }

    runDeobfuscate(): void {
        const masked = this.obfuscatedSql();
        if (!masked) return;

        const restored = this.sqlService.deobfuscate(masked);
        this.originalSql.set(restored);
    }

    onClearAll(): void {
        this.originalSql.set('');
        this.obfuscatedSql.set('');
        this.sqlService.clearMappings();
        this.lastExecStats.set(null);
        // Note: sqlOptions is NOT changed, preserving user-selected dialect & toggles
    }
}
