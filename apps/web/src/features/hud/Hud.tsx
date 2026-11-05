import { Flame, Sparkle, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useGame } from '../../store/game';

export function Hud() {
  const progress = useGame((state) => state.sky.progress);
  const { xp, levelFloor, nextLevelAt, levelName, level, streakDays, mastered } = progress;
  const fill = nextLevelAt ? (xp - levelFloor) / (nextLevelAt - levelFloor) : 1;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-6 px-7 pt-5">
      <h1 className="font-display text-3xl italic">Curio</h1>

      <div className="flex items-center gap-6">
        <div className="w-52">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="font-display italic text-gold">{levelName}</span>
              <span className="text-mist"> level {level}</span>
            </span>
            <span className="text-mist">{xp} XP</span>
          </div>
          <div
            role="progressbar"
            aria-label="Progress to the next level"
            aria-valuenow={Math.round(fill * 100)}
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rule"
          >
            <motion.div
              className="h-full rounded-full bg-gold"
              initial={false}
              animate={{ width: `${fill * 100}%` }}
              transition={{ type: 'spring', stiffness: 90, damping: 18 }}
            />
          </div>
        </div>

        <span className="flex items-center gap-1.5" title="Days in a row">
          <Flame size={18} className="text-history" aria-hidden="true" />
          {streakDays}
          <span className="sr-only">day streak</span>
        </span>

        <span className="flex items-center gap-1.5" title="Concepts mastered">
          <Star size={18} className="text-gold" aria-hidden="true" />
          {mastered}
          <span className="sr-only">concepts mastered</span>
        </span>

        <span className="text-mist/40" title="Curiosity Scout has nothing to tell you yet">
          <Sparkle size={18} aria-hidden="true" />
          <span className="sr-only">Curiosity Scout is quiet</span>
        </span>
      </div>
    </header>
  );
}
