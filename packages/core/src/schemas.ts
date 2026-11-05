import { z } from 'zod';

export const CLUSTERS = ['history', 'science', 'ideas', 'geography', 'language', 'arts'] as const;
export type Cluster = (typeof CLUSTERS)[number];

export const LEVELS = ['new', 'some', 'solid'] as const;

export const CONCEPT_STATUSES = ['forming', 'locked', 'current', 'mastered'] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];

export const EDGE_KINDS = ['within', 'prior', 'cross_topic'] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const TopicInput = z.object({
  topic: z.string().trim().min(3, 'Type at least 3 characters.').max(160),
});

export const CheckInput = z.object({
  answers: z.record(z.string(), z.number().int().min(0).max(3)),
});

export const KnownConcept = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  cluster: z.enum(CLUSTERS),
  status: z.enum(CONCEPT_STATUSES),
  masteredAt: z.number().nullable(),
});
export type KnownConcept = z.infer<typeof KnownConcept>;

/** The room document keeper owns: everything the learner knows so far. */
export const MindMap = z.object({
  concepts: z.array(KnownConcept),
  edges: z.array(z.object({ from: z.string(), to: z.string(), kind: z.enum(EDGE_KINDS) })),
});
export type MindMap = z.infer<typeof MindMap>;

/** What Scout's model returns. */
export const Assessment = z.object({
  target: z.string().min(3).max(200),
  level: z.enum(LEVELS),
  related: z.array(z.string()).max(8),
  note: z.string().max(300),
});
export type Assessment = z.infer<typeof Assessment>;

/** The room document Scout writes for Curriculum. */
export const TargetDocument = z.object({
  topicId: z.string(),
  topic: z.string(),
  target: z.string(),
  level: z.enum(LEVELS),
  related: z.array(KnownConcept),
});
export type TargetDocument = z.infer<typeof TargetDocument>;

/** What Curriculum's model returns. A link's `to` is "#2" for this map, or a known id. */
export const ConceptMapDraft = z.object({
  topicTitle: z.string().min(2).max(60),
  cluster: z.enum(CLUSTERS),
  summary: z.string().max(400),
  concepts: z
    .array(
      z.object({
        title: z.string().min(2).max(48),
        summary: z.string().min(5).max(200),
        links: z.array(z.object({ to: z.string(), why: z.string().min(5).max(200) })).max(3),
      }),
    )
    .min(4)
    .max(6),
});
export type ConceptMapDraft = z.infer<typeof ConceptMapDraft>;

/** The room document Curriculum writes for Keeper and Teacher. */
export const MapDocument = z.object({
  topicId: z.string(),
  title: z.string(),
  cluster: z.enum(CLUSTERS),
  summary: z.string(),
  concepts: z.array(
    z.object({
      id: z.string(),
      order: z.number().int(),
      title: z.string(),
      summary: z.string(),
      links: z.array(
        z.object({ toId: z.string(), kind: z.enum(EDGE_KINDS), why: z.string() }),
      ),
    }),
  ),
  known: z.array(KnownConcept),
});
export type MapDocument = z.infer<typeof MapDocument>;

export const QuestionDraft = z.object({
  prompt: z.string().min(5).max(300),
  options: z.array(z.string().min(1).max(200)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(5).max(300),
});

/** What Teacher's model returns, and what the lessons document holds. */
export const LessonDraft = z.object({
  paragraphs: z.array(z.string().min(20).max(900)).min(2).max(4),
  connection: z
    .object({ conceptId: z.string(), sentence: z.string().min(5).max(300) })
    .nullable()
    .default(null),
  questions: z.array(QuestionDraft).length(3),
});
export type LessonDraft = z.infer<typeof LessonDraft>;

export const LessonsDocument = z.object({
  topicId: z.string(),
  lessons: z.record(z.string(), LessonDraft),
});
export type LessonsDocument = z.infer<typeof LessonsDocument>;
