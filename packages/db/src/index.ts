import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  dayOf,
  levelFor,
  masteryXp,
  nextStreak,
  PASS_SCORE,
  XP,
  type ActivityView,
  type CheckResult,
  type Cluster,
  type ConceptStatus,
  type ConceptView,
  type EdgeKind,
  type EdgeView,
  type LessonDraft,
  type LessonView,
  type MapDocument,
  type MindMap,
  type SkyView,
  type TopicView,
} from '@curio/core';
import {
  activity,
  attempts,
  concepts,
  edges,
  lessons,
  progress,
  questions,
  topics,
} from './schema';

// Tables are created here rather than by a migration tool. The database is
// local and disposable: delete data/ after a schema change.
const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, cluster TEXT, status TEXT NOT NULL,
    failure_reason TEXT, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS concepts (
    id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL,
    cluster TEXT NOT NULL, position INTEGER NOT NULL, status TEXT NOT NULL, mastered_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, kind TEXT NOT NULL,
    why TEXT NOT NULL, created_by TEXT NOT NULL, revealed_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS lessons (
    concept_id TEXT PRIMARY KEY, paragraphs TEXT NOT NULL, connection_id TEXT,
    connection_sentence TEXT, read_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY, concept_id TEXT NOT NULL, position INTEGER NOT NULL, prompt TEXT NOT NULL,
    options TEXT NOT NULL, correct_index INTEGER NOT NULL, explanation TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, concept_id TEXT NOT NULL, score INTEGER NOT NULL,
    total INTEGER NOT NULL, passed INTEGER NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY, xp INTEGER NOT NULL, streak_days INTEGER NOT NULL, last_active_day TEXT
  );
  CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY, sender TEXT NOT NULL, sender_name TEXT NOT NULL, body TEXT NOT NULL,
    timestamp REAL NOT NULL
  );
`;

const PROGRESS_ROW = 1;

export type Mastery = { result: CheckResult; title: string; edgeIds: string[] };

export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(CREATE_TABLES);
  const db = drizzle(sqlite);

  db.insert(progress).values({ id: PROGRESS_ROW, xp: 0, streakDays: 0 }).onConflictDoNothing().run();

  function readProgress() {
    return db.select().from(progress).where(eq(progress.id, PROGRESS_ROW)).get()!;
  }

  /** Adds XP and counts today towards the streak. */
  function award(xp: number): void {
    const current = readProgress();
    const today = dayOf(Date.now());
    db.update(progress)
      .set({
        xp: current.xp + xp,
        streakDays: nextStreak(current.streakDays, current.lastActiveDay, today),
        lastActiveDay: today,
      })
      .where(eq(progress.id, PROGRESS_ROW))
      .run();
  }

  /** Makes the topic's first unmastered concept current, once its lesson exists. */
  function advance(topicId: string): void {
    const rows = db
      .select()
      .from(concepts)
      .where(eq(concepts.topicId, topicId))
      .orderBy(asc(concepts.order))
      .all();
    if (rows.some((row) => row.status === 'current')) return;
    const next = rows.find((row) => row.status !== 'mastered');
    if (next?.status === 'locked') {
      db.update(concepts).set({ status: 'current' }).where(eq(concepts.id, next.id)).run();
    }
  }

  function readSky(): SkyView {
    const current = readProgress();
    const conceptRows = db.select().from(concepts).orderBy(asc(concepts.order)).all();
    return {
      topics: db
        .select()
        .from(topics)
        .orderBy(asc(topics.createdAt))
        .all()
        .map((row) => ({
          ...row,
          cluster: row.cluster as Cluster | null,
          status: row.status as TopicView['status'],
        })),
      concepts: conceptRows.map((row) => ({
        ...row,
        cluster: row.cluster as Cluster,
        status: row.status as ConceptStatus,
      })) satisfies ConceptView[],
      edges: db
        .select({
          id: edges.id,
          fromId: edges.fromId,
          toId: edges.toId,
          kind: edges.kind,
          why: edges.why,
          revealedAt: edges.revealedAt,
        })
        .from(edges)
        .all()
        .map((row) => ({ ...row, kind: row.kind as EdgeKind })) satisfies EdgeView[],
      progress: {
        xp: current.xp,
        streakDays: current.streakDays,
        mastered: conceptRows.filter((row) => row.status === 'mastered').length,
        ...levelFor(current.xp),
      },
    };
  }

  function readQuestions(conceptId: string) {
    return db
      .select()
      .from(questions)
      .where(eq(questions.conceptId, conceptId))
      .orderBy(asc(questions.position))
      .all();
  }

  return {
    readSky,

    createTopic(id: string, title: string): void {
      db.insert(topics)
        .values({ id, title, status: 'building', createdAt: Date.now() })
        .onConflictDoNothing()
        .run();
    },

    topicStatus(id: string): string | null {
      return db.select().from(topics).where(eq(topics.id, id)).get()?.status ?? null;
    },

    failTopic(id: string, reason: string): void {
      db.update(topics)
        .set({ status: 'failed', failureReason: reason })
        .where(eq(topics.id, id))
        .run();
    },

    /** Saves a concept map. Repeating a delivery changes nothing. */
    saveMap(map: MapDocument): void {
      sqlite.transaction(() => {
        db.insert(topics)
          .values({ id: map.topicId, title: map.title, status: 'building', createdAt: Date.now() })
          .onConflictDoNothing()
          .run();
        const saved = db.select().from(concepts).where(eq(concepts.topicId, map.topicId)).get();
        if (saved) return;

        db.update(topics)
          .set({ title: map.title, cluster: map.cluster, status: 'ready' })
          .where(eq(topics.id, map.topicId))
          .run();
        for (const concept of map.concepts) {
          db.insert(concepts)
            .values({
              id: concept.id,
              topicId: map.topicId,
              title: concept.title,
              summary: concept.summary,
              cluster: map.cluster,
              order: concept.order,
              status: 'forming',
            })
            .run();
          for (const link of concept.links) {
            db.insert(edges)
              .values({
                id: `${concept.id}__${link.toId}`,
                fromId: concept.id,
                toId: link.toId,
                kind: link.kind,
                why: link.why,
                createdBy: 'curriculum',
                // Links to prior knowledge stay hidden until the concept is mastered.
                revealedAt: link.kind === 'within' ? Date.now() : null,
              })
              .onConflictDoNothing()
              .run();
          }
        }
      })();
    },

    /** Saves a lesson and its check, then lets the concept open. Safe to repeat. */
    saveLesson(conceptId: string, lesson: LessonDraft): void {
      sqlite.transaction(() => {
        const concept = db.select().from(concepts).where(eq(concepts.id, conceptId)).get();
        if (!concept || concept.status !== 'forming') return;

        db.insert(lessons)
          .values({
            conceptId,
            paragraphs: lesson.paragraphs,
            connectionId: lesson.connection?.conceptId ?? null,
            connectionSentence: lesson.connection?.sentence ?? null,
          })
          .onConflictDoNothing()
          .run();
        lesson.questions.forEach((question, position) => {
          db.insert(questions)
            .values({ ...question, id: `${conceptId}_q${position}`, conceptId, position })
            .onConflictDoNothing()
            .run();
        });
        db.update(concepts).set({ status: 'locked' }).where(eq(concepts.id, conceptId)).run();
        advance(concept.topicId);
      })();
    },

    /** The lesson as the browser may see it: no answers. */
    readLesson(conceptId: string): LessonView | null {
      const lesson = db.select().from(lessons).where(eq(lessons.conceptId, conceptId)).get();
      if (!lesson) return null;
      const linked = lesson.connectionId
        ? db.select().from(concepts).where(eq(concepts.id, lesson.connectionId)).get()
        : undefined;
      return {
        conceptId,
        paragraphs: lesson.paragraphs,
        connection:
          linked && lesson.connectionSentence
            ? { conceptId: linked.id, title: linked.title, sentence: lesson.connectionSentence }
            : null,
        questions: readQuestions(conceptId).map(({ id, prompt, options }) => ({
          id,
          prompt,
          options,
        })),
      };
    },

    /** Awards lesson XP the first time a lesson is opened. Returns whether it did. */
    markRead(conceptId: string): boolean {
      return sqlite.transaction(() => {
        const unread = db
          .update(lessons)
          .set({ readAt: Date.now() })
          .where(and(eq(lessons.conceptId, conceptId), isNull(lessons.readAt)))
          .run();
        if (unread.changes === 0) return false;
        award(XP.lesson);
        return true;
      })();
    },

    /** Grades a check. A pass masters the concept and reveals its hidden links. */
    gradeCheck(conceptId: string, answers: Record<string, number>): Mastery | null {
      return sqlite.transaction(() => {
        const concept = db.select().from(concepts).where(eq(concepts.id, conceptId)).get();
        const rows = readQuestions(conceptId);
        if (!concept || rows.length === 0) return null;

        const score = rows.filter((row) => answers[row.id] === row.correctIndex).length;
        const passed = score >= PASS_SCORE;
        const alreadyMastered = concept.status === 'mastered';
        const firstTry = !db
          .select()
          .from(attempts)
          .where(eq(attempts.conceptId, conceptId))
          .get();
        const xpGained = alreadyMastered ? 0 : masteryXp(passed, firstTry);

        db.insert(attempts)
          .values({ conceptId, score, total: rows.length, passed, createdAt: Date.now() })
          .run();

        const edgeIds: string[] = [];
        if (passed && !alreadyMastered) {
          const now = Date.now();
          db.update(concepts)
            .set({ status: 'mastered', masteredAt: now })
            .where(eq(concepts.id, conceptId))
            .run();
          const hidden = db
            .select()
            .from(edges)
            .where(and(eq(edges.fromId, conceptId), isNull(edges.revealedAt)))
            .all();
          for (const edge of hidden) {
            db.update(edges).set({ revealedAt: now }).where(eq(edges.id, edge.id)).run();
            edgeIds.push(edge.id);
          }
          award(xpGained);
          advance(concept.topicId);
        }

        return {
          title: concept.title,
          edgeIds,
          result: {
            passed,
            score,
            total: rows.length,
            xpGained,
            results: rows.map((row) => ({
              questionId: row.id,
              correctIndex: row.correctIndex,
              explanation: row.explanation,
            })),
          },
        };
      })();
    },

    /** The shared document's contents. Agents read this through Switch. */
    readMindMap(): MindMap {
      const sky = readSky();
      return {
        concepts: sky.concepts.map(({ id, title, summary, cluster, status, masteredAt }) => ({
          id,
          title,
          summary,
          cluster,
          status,
          masteredAt,
        })),
        edges: sky.edges.map(({ fromId, toId, kind }) => ({ from: fromId, to: toId, kind })),
      };
    },

    addActivity(item: ActivityView & { sender: string }): void {
      db.insert(activity).values(item).onConflictDoNothing().run();
    },

    recentActivity(limit = 50): ActivityView[] {
      return db
        .select({
          id: activity.id,
          senderName: activity.senderName,
          body: activity.body,
          timestamp: activity.timestamp,
        })
        .from(activity)
        .orderBy(desc(activity.timestamp))
        .limit(limit)
        .all()
        .reverse();
    },
  };
}

export type Db = ReturnType<typeof openDb>;
