import { useEffect, useRef } from 'react';
import { useGame } from '../../store/game';

const VISIBLE_MESSAGES = 12;

export function TeamFeed() {
  const activity = useGame((state) => state.activity);
  const list = useRef<HTMLOListElement>(null);
  const recent = activity.slice(-VISIBLE_MESSAGES);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [activity.length]);

  return (
    <aside
      aria-label="Live messages from the team room"
      className="absolute bottom-6 left-7 z-10 w-[300px] rounded-md border border-rule bg-panel/80 px-4 py-3"
    >
      <h2 className="flex items-center gap-2 font-display text-base italic">
        <span className="size-2 rounded-full bg-geography" aria-hidden="true" />
        #curio-mind
      </h2>
      <ol ref={list} aria-live="polite" className="mt-2 max-h-[24vh] space-y-2 overflow-y-auto">
        {recent.map((item) => (
          <li key={item.id} className="text-sm leading-snug">
            <span className="font-medium text-gold">{item.senderName}</span>
            <p className="line-clamp-3 text-mist">{item.body}</p>
          </li>
        ))}
        {recent.length === 0 && <li className="text-sm text-mist">The team is quiet.</li>}
      </ol>
    </aside>
  );
}
