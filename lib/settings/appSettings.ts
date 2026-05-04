export interface ExamDate {
  subject: string;
  date: string;
}

export interface AppSettings {
  onboardingComplete: boolean;
  userMode: "owner" | "guest";
  examDates: ExamDate[];
  ownerPinHash: string | null;
}

const DEFAULTS: AppSettings = {
  onboardingComplete: false,
  userMode: "guest",
  examDates: [],
  ownerPinHash: null,
};

const KEY = "sbobby_settings";

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const updated = { ...current, ...patch };
  saveSettings(updated);
  return updated;
}
