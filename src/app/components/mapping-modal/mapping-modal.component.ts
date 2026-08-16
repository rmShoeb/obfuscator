import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TokenCategory, TokenMapping } from '../../models/obfuscator.interface';
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
    readonly selectedCategory = signal<'all' | TokenCategory>('all');
    private sqlService = inject(SqlObfuscatorService);
    isModalOpen = signal<boolean>(false);
    searchQuery = signal<string>('');

    readonly filteredMappings = computed(() => {
        let list = this.mappings();
        const query = this.searchQuery().trim().toLowerCase();
        const cat = this.selectedCategory();

        if (cat !== 'all') {
            list = list.filter(m => m.category === cat);
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
            a.download = `obfuscator-mappings-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("An error occurred:", error);
            // TODO: replace this later with alerting modal
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
                // TODO: replace this later with alerting modal
            }
            inputEl.value = '';
        };

        reader.readAsText(file);
    }

    deleteMappings(): void {
        this.sqlService.clearMappings();
    }
}
