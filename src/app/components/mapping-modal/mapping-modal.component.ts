import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TokenMapping } from '../../models/obfuscator.interface';
import { SqlObfuscatorService } from '../../services/sql-obfuscator.service';

@Component({
    selector: 'app-mapping-modal',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule
    ],
    templateUrl: './mapping-modal.component.html',
    styleUrl: './mapping-modal.component.css',
})
export class MappingModalComponent {
    readonly mappings = input<TokenMapping[]>([]);
    readonly selectedFilter = signal<string>('all');
    private sqlService = inject(SqlObfuscatorService);
    readonly isModalOpen = signal<boolean>(false);
    readonly searchQuery = signal<string>('');
    readonly activeDialect = this.sqlService.currentDialect;

    readonly filteredMappings = computed(() => {
        let list = this.mappings();
        const query = this.searchQuery().trim().toLowerCase();
        const filter = this.selectedFilter();

        if (filter !== 'all') {
            if (filter === 'database') {
                list = list.filter(m => m.subCategory === 'database');
            } else if (filter === 'table') {
                list = list.filter(m => m.subCategory === 'table');
            } else if (filter === 'column') {
                list = list.filter(m => m.subCategory === 'column');
            } else if (filter === 'string_literal') {
                list = list.filter(m => m.category === 'string_literal');
            } else if (filter === 'generic') {
                list = list.filter(m => m.category === 'identifier' && (!m.subCategory || m.subCategory === 'generic'));
            }
        }

        if (query) {
            list = list.filter(m =>
                m.original.toLowerCase().includes(query) ||
                m.obfuscated.toLowerCase().includes(query)
            );
        }

        return list;
    });

    openModal(): void {
        this.isModalOpen.set(true);
    }

    closeModal(): void {
        this.isModalOpen.set(false);
    }

    onExportJson(): void {
        try {
            const json = this.sqlService.exportMappings();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `obfuscator-mappings-${this.activeDialect()}-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("An error occurred during export:", error);
        }
    }

    onImportFile(event: Event): void {
        const inputEl = event.target as HTMLInputElement;
        if (!inputEl.files || inputEl.files.length === 0) return;

        const file = inputEl.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target?.result as string;
            const res = this.sqlService.importMappings(content);
            if (!res.success) {
                console.error(res.error || 'Failed to import JSON file.');
            }
            inputEl.value = '';
        };

        reader.readAsText(file);
    }

    deleteMappings(): void {
        this.sqlService.clearMappings();
    }
}
