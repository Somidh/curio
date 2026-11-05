import { EventEmitter } from 'node:events';
import { CheckInput, TopicInput, type AppState, type ServerEvent } from '@curio/core';
import type { Db } from '@curio/db';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Keeper } from '../agents/keeper';

const KEEPALIVE_MS = 15_000;

export function createBus() {
  const bus = new EventEmitter();
  bus.setMaxListeners(0);
  return {
    emit: (event: ServerEvent) => bus.emit('event', event),
    subscribe(listener: (event: ServerEvent) => void) {
      bus.on('event', listener);
      return () => {
        bus.off('event', listener);
      };
    },
  };
}

type Bus = ReturnType<typeof createBus>;

export function createApp(db: Db, keeper: Keeper, bus: Bus): Hono {
  const app = new Hono();

  app.get('/api/state', (c) => {
    const state: AppState = {
      switchConnected: keeper.agent.connected,
      sky: db.readSky(),
      activity: db.recentActivity(),
    };
    return c.json(state);
  });

  app.post('/api/topics', async (c) => {
    const input = TopicInput.safeParse(await c.req.json().catch(() => null));
    if (!input.success) {
      return c.json({ error: input.error.issues[0]?.message ?? 'Name a topic.' }, 400);
    }
    if (!keeper.agent.connected) {
      return c.json({ error: 'Switch is not connected. Start it with pnpm switch:up.' }, 503);
    }
    return c.json({ topicId: await keeper.startTopic(input.data.topic) }, 201);
  });

  app.post('/api/concepts/:id/lesson', (c) => {
    const lesson = keeper.openLesson(c.req.param('id'));
    return lesson ? c.json(lesson) : c.json({ error: 'This lesson is not ready yet.' }, 404);
  });

  app.post('/api/concepts/:id/check', async (c) => {
    const input = CheckInput.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json({ error: 'Answer every question.' }, 400);
    const result = await keeper.submitCheck(c.req.param('id'), input.data.answers);
    return result ? c.json(result) : c.json({ error: 'This check is not ready yet.' }, 404);
  });

  app.get('/api/events', (c) =>
    streamSSE(c, async (stream) => {
      const unsubscribe = bus.subscribe((event) => {
        void stream.writeSSE({ data: JSON.stringify(event) });
      });
      stream.onAbort(unsubscribe);
      while (!stream.aborted) {
        await stream.sleep(KEEPALIVE_MS);
        await stream.writeSSE({ event: 'keepalive', data: '' });
      }
    }),
  );

  return app;
}
