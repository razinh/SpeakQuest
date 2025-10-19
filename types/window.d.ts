interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
}

declare global {
  interface Window {
    aistudio?: AIStudio;
  }
}

export {};