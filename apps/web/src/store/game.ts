import type {
  AppState,
  CheckResult,
  LessonView,
  ServerEvent,
  SkyView,
} from '@curio/core';
import { create } from 'zustand';

const FEED_LIMIT = 50;
const OFFLINE = 'The Curio server is not running. Start it with pnpm dev.';

const EMPTY_SKY: SkyView = {
  topics: [],
  concepts: [],
  edges: [],
  progress: {
    xp: 0,
    level: 1,
    levelName: 'Wanderer',
    levelFloor: 0,
    nextLevelAt: 200,
    streakDays: 0,
    mastered: 0,
  },
};

export type Celebration = { conceptId: string; edgeIds: string[]; xpGained: number };

type GameStore = AppState & {
  loaded: boolean;
  submitting: boolean;
  error: string | null;
  openConceptId: string | null;
  lesson: LessonView | null;
  /** Waits behind the open lesson, so it plays where you can see it. */
  heldCelebration: Celebration | null;
  celebration: Celebration | null;
  connect(): () => void;
  submitTopic(topic: string): Promise<boolean>;
  openConcept(id: string): Promise<void>;
  closeConcept(): void;
  submitCheck(answers: Record<string, number>): Promise<CheckResult | null>;
  finishCelebration(): void;
};

export const useGame = create<GameStore>((set, get) => ({
  switchConnected: false,
  sky: EMPTY_SKY,
  activity: [],
  loaded: false,
  submitting: false,
  error: null,
  openConceptId: null,
  lesson: null,
  heldCelebration: null,
  celebration: null,

  connect() {
    const source = new EventSource('/api/events');

    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as ServerEvent;
      if (event.type === 'switch') set({ switchConnected: event.connected });
      if (event.type === 'sky') set({ sky: event.sky });
      if (event.type === 'mastered') {
        const { conceptId, edgeIds, xpGained } = event;
        set({ heldCelebration: { conceptId, edgeIds, xpGained } });
      }
      if (event.type === 'activity') {
        const known = get().activity.some((item) => item.id === event.item.id);
        if (!known) set({ activity: [...get().activity, event.item].slice(-FEED_LIMIT) });
      }
    };

    void fetch('/api/state')
      .then((response) => response.json() as Promise<AppState>)
      .then((state) => set({ ...state, loaded: true }))
      .catch(() => set({ loaded: true, error: OFFLINE }));

    return () => source.close();
  },

  async submitTopic(topic) {
    set({ submitting: true, error: null });
    const response = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    }).catch(() => null);

    if (!response) {
      set({ submitting: false, error: OFFLINE });
      return false;
    }
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      set({ submitting: false, error: body.error ?? 'That topic could not start.' });
      return false;
    }
    set({ submitting: false });
    return true;
  },

  async openConcept(id) {
    set({ openConceptId: id, lesson: null });
    const response = await fetch(`/api/concepts/${id}/lesson`, { method: 'POST' }).catch(() => null);
    if (get().openConceptId !== id) return;
    if (!response?.ok) {
      set({ openConceptId: null, error: 'That lesson could not open. Try again.' });
      return;
    }
    set({ lesson: (await response.json()) as LessonView });
  },

  closeConcept() {
    const { heldCelebration } = get();
    set({
      openConceptId: null,
      lesson: null,
      heldCelebration: null,
      celebration: heldCelebration,
    });
  },

  async submitCheck(answers) {
    const id = get().openConceptId;
    if (!id) return null;
    const response = await fetch(`/api/concepts/${id}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    }).catch(() => null);
    if (!response?.ok) {
      set({ error: 'Your answers could not be checked. Try again.' });
      return null;
    }
    return (await response.json()) as CheckResult;
  },

  finishCelebration() {
    set({ celebration: null });
  },
}));
