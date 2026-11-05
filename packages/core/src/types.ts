import type { Cluster, ConceptStatus, EdgeKind } from './schemas';

export type TopicView = {
  id: string;
  title: string;
  cluster: Cluster | null;
  status: 'building' | 'ready' | 'failed';
  failureReason: string | null;
  createdAt: number;
};

export type ConceptView = {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  cluster: Cluster;
  order: number;
  status: ConceptStatus;
  masteredAt: number | null;
};

export type EdgeView = {
  id: string;
  fromId: string;
  toId: string;
  kind: EdgeKind;
  why: string;
  revealedAt: number | null;
};

export type ProgressView = {
  xp: number;
  level: number;
  levelName: string;
  levelFloor: number;
  nextLevelAt: number | null;
  streakDays: number;
  mastered: number;
};

export type SkyView = {
  topics: TopicView[];
  concepts: ConceptView[];
  edges: EdgeView[];
  progress: ProgressView;
};

export type LessonView = {
  conceptId: string;
  paragraphs: string[];
  connection: { conceptId: string; title: string; sentence: string } | null;
  questions: { id: string; prompt: string; options: string[] }[];
};

export type CheckResult = {
  passed: boolean;
  score: number;
  total: number;
  xpGained: number;
  results: { questionId: string; correctIndex: number; explanation: string }[];
};

export type ActivityView = {
  id: string;
  senderName: string;
  body: string;
  timestamp: number;
};

export type AppState = {
  switchConnected: boolean;
  sky: SkyView;
  activity: ActivityView[];
};

export type ServerEvent =
  | { type: 'switch'; connected: boolean }
  | { type: 'sky'; sky: SkyView }
  | { type: 'mastered'; conceptId: string; edgeIds: string[]; xpGained: number }
  | { type: 'activity'; item: ActivityView };
