import type { ConceptStatus, ConceptView } from '@curio/core';
import { motion } from 'motion/react';
import { CLUSTER_COLORS, GOLD } from './clusters';
import type { Point } from './layout';

const CHARS_PER_LINE = 18;

function wrapTitle(title: string): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of title.split(' ')) {
    if (line && `${line} ${word}`.length > CHARS_PER_LINE) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  return [...lines, line];
}

const STATUS_LABELS: Record<ConceptStatus, string> = {
  forming: 'being written',
  locked: 'locked',
  current: 'ready to learn',
  mastered: 'mastered',
};

type StarProps = {
  concept: ConceptView;
  status: ConceptStatus;
  point: Point;
  from: Point;
  delay: number;
  onOpen: (id: string) => void;
  onHover: (id: string | null, x: number, y: number) => void;
};

export function Star({ concept, status, point, from, delay, onOpen, onHover }: StarProps) {
  const color = CLUSTER_COLORS[concept.cluster];
  const canOpen = status === 'current' || status === 'mastered';
  const mastered = status === 'mastered';
  const current = status === 'current';
  const lines = wrapTitle(concept.title);
  const labelY = current || mastered ? 40 : 30;

  return (
    <motion.g
      id={`star-${concept.id}`}
      initial={{ x: from.x, y: from.y, scale: 0, opacity: 0 }}
      animate={{ x: point.x, y: point.y, scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 170, damping: 15, delay }}
      role={canOpen ? 'button' : 'img'}
      tabIndex={0}
      aria-label={`${concept.title}, ${STATUS_LABELS[status]}`}
      className={canOpen ? 'cursor-pointer' : undefined}
      onClick={canOpen ? () => onOpen(concept.id) : undefined}
      onKeyDown={(event) => {
        if (canOpen && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen(concept.id);
        }
      }}
      onPointerEnter={(event) => onHover(concept.id, event.clientX, event.clientY)}
      onPointerMove={(event) => onHover(concept.id, event.clientX, event.clientY)}
      onPointerLeave={() => onHover(null, 0, 0)}
      onFocus={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        onHover(concept.id, box.left + box.width / 2, box.top);
      }}
      onBlur={() => onHover(null, 0, 0)}
    >
      {/* A larger target than the star itself. */}
      <circle r="30" fill="transparent" />

      {status !== 'forming' && (
        <circle
          r={mastered ? 40 : current ? 46 : 22}
          fill={`url(#halo-${concept.cluster})`}
          opacity={status === 'locked' ? 0.35 : 1}
        />
      )}

      {current && (
        <motion.circle
          r="15"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          animate={{ scale: [1, 2.5], opacity: [0.9, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {status === 'forming' && (
        <motion.circle
          r="3"
          fill={color}
          animate={{ opacity: [0.25, 0.8, 0.25] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}
      {status === 'locked' && (
        <circle r="6" fill="#07070f" stroke={color} strokeWidth="1.5" opacity="0.85" />
      )}
      {current && <circle r="9" fill={color} />}
      {mastered && (
        <>
          <circle r="11" fill="none" stroke={color} strokeWidth="1" opacity="0.8" />
          <circle r="7.5" fill={GOLD} />
        </>
      )}
      {current && <circle r="3.5" fill="#fff" />}

      <text
        textAnchor="middle"
        y={labelY}
        fill={status === 'locked' || status === 'forming' ? '#a5a1c4' : '#efecf8'}
        fontFamily="Fraunces Variable, Georgia, serif"
        fontStyle="italic"
        fontSize="15"
        stroke="#07070f"
        strokeWidth="4"
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {lines.map((line, row) => (
          <tspan key={row} x="0" dy={row === 0 ? 0 : 18}>
            {line}
          </tspan>
        ))}
      </text>
    </motion.g>
  );
}
