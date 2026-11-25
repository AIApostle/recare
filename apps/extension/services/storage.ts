import { UserPreferences, StoredConversation } from '../types';

const PREFERENCES_STORAGE_KEY = 'recare_user_preferences';
const ONBOARDING_COMPLETED_KEY = 'recare_onboarding_completed';
const CONVERSATIONS_STORAGE_KEY = 'recare_conversations';
const ACTIVE_CONVERSATION_KEY = 'recare_active_conversation_id';
const MAX_STORED_CONVERSATIONS = 40;

export const DEFAULT_PREFERENCES: UserPreferences = {
  interaction_mode: 'assist',
  inference_mode: 'PREFER_IN_CLOUD',
  speech_rate: 1.0,
  text_size: 'medium',
  voice_enabled: true,
  response_output_mode: 'both',
  voice_gender: 'neutral',
  simplified_language: false,
  reduced_motion: false,
  high_contrast: false,
  auto_approve_low_risk: true,
};

async function readStorage<T>(key: string): Promise<T | null> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(key);
      return (result[key] as T) ?? null;
    }
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
  } catch {
    // Ignore storage read errors in restricted test contexts
  }
  return null;
}

async function writeStorage<T>(key: string, value: T): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: value });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.warn(`Failed to write ${key} to storage:`, e);
  }
}

export class StorageService {
  static async getPreferences(): Promise<UserPreferences> {
    const stored = await readStorage<UserPreferences>(PREFERENCES_STORAGE_KEY);
    return stored ? { ...DEFAULT_PREFERENCES, ...stored } : DEFAULT_PREFERENCES;
  }

  static async savePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences();
    const updated = { ...current, ...prefs };
    await writeStorage(PREFERENCES_STORAGE_KEY, updated);
    return updated;
  }

  static async isOnboardingCompleted(): Promise<boolean> {
    const stored = await readStorage<boolean | string>(ONBOARDING_COMPLETED_KEY);
    return stored === true || stored === 'true';
  }

  static async setOnboardingCompleted(completed: boolean = true): Promise<void> {
    await writeStorage(ONBOARDING_COMPLETED_KEY, completed);
  }

  /** Retrieve all saved conversation threads sorted newest-first */
  static async getConversations(): Promise<StoredConversation[]> {
    const stored = await readStorage<StoredConversation[]>(CONVERSATIONS_STORAGE_KEY);
    if (!Array.isArray(stored)) return [];
    return [...stored].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /** Insert or update a conversation thread and persist locally */
  static async saveConversation(conversation: StoredConversation): Promise<StoredConversation[]> {
    const existing = await this.getConversations();
    const filtered = existing.filter((c) => c.id !== conversation.id);
    const next = [conversation, ...filtered].slice(0, MAX_STORED_CONVERSATIONS);
    await writeStorage(CONVERSATIONS_STORAGE_KEY, next);
    return next;
  }

  /** Remove a conversation thread from local storage */
  static async deleteConversation(conversationId: string): Promise<StoredConversation[]> {
    const existing = await this.getConversations();
    const next = existing.filter((c) => c.id !== conversationId);
    await writeStorage(CONVERSATIONS_STORAGE_KEY, next);
    const activeId = await this.getActiveConversationId();
    if (activeId === conversationId) {
      await this.setActiveConversationId(null);
    }
    return next;
  }

  static async getActiveConversationId(): Promise<string | null> {
    return await readStorage<string>(ACTIVE_CONVERSATION_KEY);
  }

  static async setActiveConversationId(conversationId: string | null): Promise<void> {
    await writeStorage(ACTIVE_CONVERSATION_KEY, conversationId);
  }
}
