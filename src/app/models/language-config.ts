export interface LanguageOption {
    id: string;
    label: string;
    disabled: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
    { id: 'sql', label: 'SQL Obfuscator', disabled: false },
    { id: 'json', label: 'JSON Obfuscator (Coming Soon)', disabled: true }
];