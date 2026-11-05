import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { CLUSTER_COLORS, CLUSTER_NAMES } from '../sky/clusters';
import { UnderstandingCheck } from './UnderstandingCheck';

export function LessonSheet({ conceptId }: { conceptId: string }) {
  const concept = useGame((state) => state.sky.concepts.find((item) => item.id === conceptId));
  const lesson = useGame((state) => state.lesson);
  const closeConcept = useGame((state) => state.closeConcept);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeConcept();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeConcept]);

  if (!concept) return null;
  const mastered = concept.status === 'mastered';

  return (
    <motion.aside
      role="dialog"
      aria-label={concept.title}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 240, damping: 30 }}
      className="absolute top-0 right-0 z-20 flex h-full w-full max-w-[600px] flex-col border-l border-rule bg-panel"
    >
      <header className="flex items-start justify-between gap-4 px-8 pt-7">
        <div>
          <p className="text-sm" style={{ color: CLUSTER_COLORS[concept.cluster] }}>
            {CLUSTER_NAMES[concept.cluster]}
          </p>
          <h2 className="mt-1 font-display text-4xl leading-tight italic">{concept.title}</h2>
        </div>
        <button
          type="button"
          aria-label="Close lesson"
          onClick={closeConcept}
          className="rounded-md p-1.5 text-mist hover:text-ink"
        >
          <X size={22} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pt-5 pb-10">
        {!lesson && <p className="text-mist">Opening the lesson</p>}

        {lesson && !checking && (
          <>
            {lesson.connection && (
              <p className="mb-5 border-l-2 border-gold pl-4 leading-snug text-gold">
                {lesson.connection.sentence}
              </p>
            )}
            <div className="max-w-[62ch] space-y-4 text-[17px] leading-relaxed">
              {lesson.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setChecking(true)}
              className="mt-8 rounded-md bg-gold px-4 py-2.5 font-semibold text-void"
            >
              {mastered ? 'Check yourself again' : 'Check my understanding'}
            </button>
          </>
        )}

        {lesson && checking && (
          <UnderstandingCheck questions={lesson.questions} onReread={() => setChecking(false)} />
        )}
      </div>
    </motion.aside>
  );
}
