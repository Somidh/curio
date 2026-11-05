import { AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
import { Hud } from './features/hud/Hud';
import { LessonSheet } from './features/lesson/LessonSheet';
import { Constellation } from './features/sky/Constellation';
import { Starfield } from './features/sky/Starfield';
import { TeamFeed } from './features/team/TeamFeed';
import { TopicInput } from './features/topic/TopicInput';
import { useGame } from './store/game';

export function App() {
  const connect = useGame((state) => state.connect);
  const loaded = useGame((state) => state.loaded);
  const switchConnected = useGame((state) => state.switchConnected);
  const topics = useGame((state) => state.sky.topics);
  const hasStars = useGame((state) => state.sky.concepts.length > 0);
  const openConceptId = useGame((state) => state.openConceptId);

  useEffect(() => connect(), [connect]);

  const building = topics.filter((topic) => topic.status === 'building');
  const failed = topics.at(-1)?.status === 'failed' ? topics.at(-1) : undefined;
  const empty = !hasStars && building.length === 0;

  return (
    <main className="relative h-full w-full overflow-hidden">
      <Starfield />
      <Constellation />
      <Hud />

      {loaded && !switchConnected && (
        <p
          role="status"
          className="absolute top-20 left-1/2 z-10 -translate-x-1/2 rounded-md bg-history px-3 py-1.5 text-sm font-medium text-void"
        >
          Switch is offline. Start it with pnpm switch:up.
        </p>
      )}

      {building.length > 0 && (
        <p
          role="status"
          className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 font-display text-lg italic text-mist"
        >
          The team is mapping {building.at(-1)?.title}
        </p>
      )}

      {failed && (
        <p
          role="alert"
          className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 text-sm text-history"
        >
          {failed.failureReason}
        </p>
      )}

      {loaded && <TopicInput centered={empty} />}
      {!empty && <TeamFeed />}

      <AnimatePresence>
        {openConceptId && <LessonSheet key={openConceptId} conceptId={openConceptId} />}
      </AnimatePresence>
    </main>
  );
}
