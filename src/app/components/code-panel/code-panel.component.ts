import { Component, input, computed, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
    selector: 'app-code-panel',
    standalone: true,
    templateUrl: './code-panel.component.html',
    styleUrl: './code-panel.component.css',
    imports: [
        CommonModule,
        FormsModule
    ]
})
export class CodePanelComponent {
    code = model<string>('');
    readonly title = input<string>('');
    readonly placeholder = input<string>('');
    readonly copied = signal<boolean>(false);
    readonly charCount = computed(() => {
        return this.code() ? this.code().length : 0;
    });

    copyCode(): void {
        if (this.code()) {
            navigator.clipboard.writeText(this.code()).then(() => {
                this.copied.set(true);
                setTimeout(() => this.copied.set(false), 2000);
            });
        }
    }

    clearCode(): void {
        this.code.set("");
    }
}
