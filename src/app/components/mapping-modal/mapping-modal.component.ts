import { Component, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TokenMapping, TokenCategory } from '../../models/obfuscator.interface';
import { SqlObfuscatorService } from '../../services/sql-obfuscator.service';

@Component({
    selector: 'app-mapping-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './mapping-modal.component.html',
    styleUrl: './mapping-modal.component.css',
})
export class MappingModalComponent {
    readonly isOpen = input<boolean>(false);
    readonly mappings = input<TokenMapping[]>([]);
    readonly closeModal = output<void>();
    readonly triggerClearAll = output<void>();
    private sqlService = inject(SqlObfuscatorService);

    searchQuery = '';
    readonly selectedCategory = signal<'all' | TokenCategory>('all');
    readonly alertMessage = signal<string>('');
    readonly alertType = signal<'success' | 'error'>('success');

    readonly filteredMappings = computed(() => {
        let list = this.mappings();
        const query = this.searchQuery.trim().toLowerCase();
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

    onBackdropClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
            this.closeModal.emit();
        }
    }

    onExportJson(): void {
        const json = this.sqlService.exportMappings();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sql-mappings-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.alertType.set('success');
        this.alertMessage.set('Mapping dictionary JSON exported successfully.');
    }

    onImportFile(event: Event): void {
        const inputEl = event.target as HTMLInputElement;
        if (!inputEl.files || inputEl.files.length === 0) return;

        const file = inputEl.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target?.result as string;
            const res = this.sqlService.importMappings(content);
            if (res.success) {
                this.alertType.set('success');
                this.alertMessage.set(`Successfully imported ${res.count} token mappings!`);
            } else {
                this.alertType.set('error');
                this.alertMessage.set(res.error || 'Failed to import JSON file.');
            }
            inputEl.value = '';
        };

        reader.readAsText(file);
    }

    onClearAllGlobal(): void {
        if (confirm('Clear both code panes and reset all token mappings? Selected options will remain unchanged.')) {
            this.triggerClearAll.emit();
            this.alertType.set('success');
            this.alertMessage.set('Cleared code panes and token mappings.');
        }
    }
}
