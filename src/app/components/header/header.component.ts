import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ObfuscatorType } from '../../models/obfuscator.interface';

interface ObfuscatorTool {
    id: ObfuscatorType;
    name: string;
    badge: string;
    enabled: boolean;
    icon: string;
}

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './header.component.html',
    styleUrl: './header.component.css'
})
export class HeaderComponent {
    readonly engineChange = output<ObfuscatorType>();
    readonly selectedEngine = signal<ObfuscatorType>('sql');

    readonly availableTools: ObfuscatorTool[] = [
        { id: 'sql', name: 'SQL Obfuscator', badge: 'Active', enabled: true, icon: 'database' },
        { id: 'json', name: 'JSON Obfuscator', badge: 'Coming Soon', enabled: false, icon: 'file-json' },
        { id: 'text', name: 'Source Code Obfuscator', badge: 'Coming Soon', enabled: false, icon: 'code' }
    ];

    onEngineChange(event: Event): void {
        const val = (event.target as HTMLSelectElement).value as ObfuscatorType;
        this.selectedEngine.set(val);
        this.engineChange.emit(val);
    }
}
