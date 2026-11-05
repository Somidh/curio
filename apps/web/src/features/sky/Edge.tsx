import type { EdgeView } from '@curio/core';
import { animate } from 'motion/react';
import { useEffect, useRef } from 'react';
import { GOLD } from './clusters';
import { edgePath, type Point } from './layout';

const DRAW_SECONDS = 1.7;

type EdgeProps = {
  edge: EdgeView;
  from: Point;
  to: Point;
  color: string;
  lit: boolean;
  drawing: boolean;
  onLanded: (edge: EdgeView) => void;
};

/** A connection between stars. When `drawing`, a comet carries the line across the sky. */
export function Edge({ edge, from, to, color, lit, drawing, onLanded }: EdgeProps) {
  const path = useRef<SVGPathElement>(null);
  const comet = useRef<SVGGElement>(null);
  const earned = edge.kind !== 'within';

  useEffect(() => {
    const line = path.current;
    const head = comet.current;
    if (!drawing || !line || !head) return;

    const length = line.getTotalLength();
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length}`;
    head.style.opacity = '1';

    const controls = animate(0, 1, {
      duration: DRAW_SECONDS,
      ease: [0.45, 0, 0.2, 1],
      onUpdate(progress) {
        const point = line.getPointAtLength(progress * length);
        line.style.strokeDashoffset = `${length * (1 - progress)}`;
        head.setAttribute('transform', `translate(${point.x} ${point.y})`);
      },
      onComplete() {
        line.style.strokeDasharray = '';
        line.style.strokeDashoffset = '';
        head.style.opacity = '0';
        onLanded(edge);
      },
    });
    return () => controls.stop();
    // Runs once per drawing, however the sky re-renders meanwhile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing]);

  return (
    <g>
      <path
        ref={path}
        d={edgePath(from, to)}
        fill="none"
        stroke={earned ? GOLD : color}
        strokeWidth={earned ? 1.8 : lit ? 1.4 : 1}
        strokeOpacity={earned ? 0.85 : lit ? 0.7 : 0.22}
        strokeLinecap="round"
      />
      <g ref={comet} style={{ opacity: 0 }} aria-hidden="true">
        <circle r="16" fill="url(#halo-comet)" />
        <circle r="3.5" fill="#fff" />
      </g>
    </g>
  );
}
