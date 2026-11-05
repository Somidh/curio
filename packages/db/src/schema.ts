import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  cluster: text('cluster'),
  status: text('status').notNull(),
  failureReason: text('failure_reason'),
  createdAt: integer('created_at').notNull(),
});

export const concepts = sqliteTable('concepts', {
  id: text('id').primaryKey(),
  topicId: text('topic_id').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  cluster: text('cluster').notNull(),
  order: integer('position').notNull(),
  status: text('status').notNull(),
  masteredAt: integer('mastered_at'),
});

export const edges = sqliteTable('edges', {
  id: text('id').primaryKey(),
  fromId: text('from_id').notNull(),
  toId: text('to_id').notNull(),
  kind: text('kind').notNull(),
  why: text('why').notNull(),
  createdBy: text('created_by').notNull(),
  revealedAt: integer('revealed_at'),
});

export const lessons = sqliteTable('lessons', {
  conceptId: text('concept_id').primaryKey(),
  paragraphs: text('paragraphs', { mode: 'json' }).$type<string[]>().notNull(),
  connectionId: text('connection_id'),
  connectionSentence: text('connection_sentence'),
  readAt: integer('read_at'),
});

export const questions = sqliteTable('questions', {
  id: text('id').primaryKey(),
  conceptId: text('concept_id').notNull(),
  position: integer('position').notNull(),
  prompt: text('prompt').notNull(),
  options: text('options', { mode: 'json' }).$type<string[]>().notNull(),
  correctIndex: integer('correct_index').notNull(),
  explanation: text('explanation').notNull(),
});

export const attempts = sqliteTable('attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conceptId: text('concept_id').notNull(),
  score: integer('score').notNull(),
  total: integer('total').notNull(),
  passed: integer('passed', { mode: 'boolean' }).notNull(),
  createdAt: integer('created_at').notNull(),
});

export const progress = sqliteTable('progress', {
  id: integer('id').primaryKey(),
  xp: integer('xp').notNull(),
  streakDays: integer('streak_days').notNull(),
  lastActiveDay: text('last_active_day'),
});

export const activity = sqliteTable('activity', {
  id: text('id').primaryKey(),
  sender: text('sender').notNull(),
  senderName: text('sender_name').notNull(),
  body: text('body').notNull(),
  timestamp: real('timestamp').notNull(),
});
