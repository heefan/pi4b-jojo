// Types
interface ContextKeys {
    openai: {
        key: string;
        endpoint: string;
        proxy: boolean;
    };
    // Add other providers as needed
}

// Helper function to safely get localStorage values
const getLocalValue = (key: string): string => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(key) || '';
};

// Default keys configuration
const DEFAULT_KEYS_STORE: ContextKeys = {
    openai: {
        key: getLocalValue('keys.openai_api_key'),
        endpoint: getLocalValue('keys.openai_api_host'),
        proxy: false,
    },
    // Add other providers as needed
};

// Function to get current keys
const getKeys = (): ContextKeys => {
    if (typeof window === 'undefined') return DEFAULT_KEYS_STORE;

    const storedKeys = localStorage.getItem('keys');
    if (!storedKeys) {
        localStorage.setItem('keys', JSON.stringify(DEFAULT_KEYS_STORE));
        return DEFAULT_KEYS_STORE;
    }

    try {
        return JSON.parse(storedKeys);
    } catch {
        return DEFAULT_KEYS_STORE;
    }
};

// Function to get headers for API requests
export const getKeysHeader = () => ({
    'x-chat-ollama-keys': encodeURIComponent(JSON.stringify(getKeys()))
});

// Function to update keys
export const updateKeys = (newKeys: Partial<ContextKeys>) => {
    if (typeof window === 'undefined') return;

    const currentKeys = getKeys();
    const updatedKeys = { ...currentKeys, ...newKeys };
    localStorage.setItem('keys', JSON.stringify(updatedKeys));
};

// Export types and default values
export { DEFAULT_KEYS_STORE };
export type { ContextKeys };

