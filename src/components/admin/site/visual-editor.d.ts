export function visualEditorMarkup(): string;
export function mountVisualEditor(
  root: HTMLElement,
  options: {
    section: { title: string; anchor?: string };
    rows: Array<{ label: string; target: { key: string }; rich: boolean }>;
    photos: Array<{ collection: string; id: string; label: string }>;
    valueOf: (target: { key: string }) => string;
    photoOf: (row: { collection: string; id: string }) => string;
    onText: (target: { key: string }, value: string) => void;
    onPhoto: (
      row: { collection: string; id: string },
      file: File,
    ) => Promise<void>;
    onSave: () => Promise<void>;
    prefs: { device: string; locale: string; path: string };
    dirtyCount: () => number;
    busy: () => boolean;
    canEdit?: (target: unknown) => boolean;
  },
): { refresh: () => void; destroy: () => void };
