import { CLUSTERS, type Cluster, type ConceptStatus, type EdgeView } from '@curio/core';
import confetti from 'canvas-confetti';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { animate, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../store/game';
import { CLUSTER_COLORS, CLUSTER_NAMES } from './clusters';
import { Edge } from './Edge';
import { anchorFor, layoutSky, type Point } from './layout';
import { Star } from './Star';

const FIT_PADDING = 170;
const MAX_FIT_SCALE = 1.25;
const RING_MARGIN = 74;

type Hover = { id: string; x: number; y: number } | null;

function clusterRings(points: { cluster: Cluster; point: Point }[]) {
  return CLUSTERS.flatMap((cluster) => {
    const members = points.filter((item) => item.cluster === cluster);
    if (members.length === 0) return [];
    const x = members.reduce((sum, item) => sum + item.point.x, 0) / members.length;
    const y = members.reduce((sum, item) => sum + item.point.y, 0) / members.length;
    const reach = Math.max(...members.map((item) => Math.hypot(item.point.x - x, item.point.y - y)));
    return [{ cluster, x, y, radius: reach + RING_MARGIN }];
  });
}

export function Constellation() {
  const sky = useGame((state) => state.sky);
  const held = useGame((state) => state.heldCelebration);
  const celebration = useGame((state) => state.celebration);
  const openConcept = useGame((state) => state.openConcept);
  const finishCelebration = useGame((state) => state.finishCelebration);

  const svg = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  const zoomer = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const camera = useRef<ZoomTransform>(zoomIdentity);
  const placed = useRef(new Map<string, Point>());
  const seen = useRef(new Set<string>());
  const [hover, setHover] = useState<Hover>(null);
  const [flares, setFlares] = useState<{ key: number; point: Point }[]>([]);

  const conceptKey = sky.concepts.map((concept) => concept.id).join();
  const points = useMemo(() => {
    const next = layoutSky(sky.concepts, sky.edges, placed.current);
    placed.current = next;
    return next;
    // Stars only move when the set of stars changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptKey]);

  useEffect(() => {
    if (!svg.current || !world.current) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 2.4])
      .on('zoom', (event) => {
        camera.current = event.transform;
        world.current?.setAttribute('transform', event.transform.toString());
      });
    zoomer.current = behavior;
    select(svg.current).call(behavior).on('dblclick.zoom', null);
  }, []);

  const flyTo = useCallback((target: ZoomTransform) => {
    const element = svg.current;
    const behavior = zoomer.current;
    if (!element || !behavior) return;
    const start = camera.current;
    return animate(0, 1, {
      duration: 1.3,
      ease: [0.4, 0, 0.2, 1],
      onUpdate(progress) {
        const scale = start.k + (target.k - start.k) * progress;
        const x = start.x + (target.x - start.x) * progress;
        const y = start.y + (target.y - start.y) * progress;
        behavior.transform(select(element), zoomIdentity.translate(x, y).scale(scale));
      },
    });
  }, []);

  // Keep every star in view as the sky grows.
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    const all = [...points.values()];
    if (all.length === 0) {
      zoomer.current?.transform(select(element), zoomIdentity.translate(width / 2, height / 2));
      return;
    }
    const xs = all.map((point) => point.x);
    const ys = all.map((point) => point.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const scale = Math.min(
      (width - FIT_PADDING * 2) / Math.max(right - left, 1),
      (height - FIT_PADDING * 2) / Math.max(bottom - top, 1),
      MAX_FIT_SCALE,
    );
    const target = zoomIdentity
      .translate(width / 2 - (scale * (left + right)) / 2, height / 2 - (scale * (top + bottom)) / 2)
      .scale(scale);
    const controls = flyTo(target);
    return () => controls?.stop();
  }, [points, flyTo]);

  // A celebration with no connection to draw still gets its burst.
  useEffect(() => {
    if (!celebration) return;
    burst(celebration.conceptId);
    if (celebration.edgeIds.length === 0) {
      const timer = setTimeout(finishCelebration, 1200);
      return () => clearTimeout(timer);
    }
  }, [celebration, finishCelebration]);

  function burst(conceptId: string) {
    const box = document.getElementById(`star-${conceptId}`)?.getBoundingClientRect();
    if (!box || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void confetti({
      particleCount: 70,
      spread: 360,
      startVelocity: 16,
      gravity: 0.35,
      ticks: 120,
      scalar: 0.75,
      colors: ['#ffd66b', '#ffffff', '#ffe9ad'],
      origin: {
        x: (box.left + box.width / 2) / window.innerWidth,
        y: (box.top + box.height / 2) / window.innerHeight,
      },
    });
  }

  function onLanded(edge: EdgeView) {
    const point = points.get(edge.toId);
    if (point) setFlares((items) => [...items, { key: Date.now(), point }]);
    finishCelebration();
  }

  const byId = new Map(sky.concepts.map((concept) => [concept.id, concept]));
  const statusOf = (id: string, status: ConceptStatus): ConceptStatus =>
    held?.conceptId === id ? 'current' : status;

  const rings = clusterRings(
    sky.concepts.flatMap((concept) => {
      const point = points.get(concept.id);
      return point ? [{ cluster: concept.cluster, point }] : [];
    }),
  );

  const visibleEdges = sky.edges.filter(
    (edge) =>
      edge.revealedAt !== null &&
      !held?.edgeIds.includes(edge.id) &&
      points.has(edge.fromId) &&
      points.has(edge.toId),
  );

  const hovered = hover ? byId.get(hover.id) : undefined;

  return (
    <>
      <svg ref={svg} className="absolute inset-0 h-full w-full" aria-label="Your knowledge constellation">
        <defs>
          {CLUSTERS.map((cluster) => (
            <radialGradient key={cluster} id={`halo-${cluster}`}>
              <stop offset="0%" stopColor={CLUSTER_COLORS[cluster]} stopOpacity="0.55" />
              <stop offset="45%" stopColor={CLUSTER_COLORS[cluster]} stopOpacity="0.14" />
              <stop offset="100%" stopColor={CLUSTER_COLORS[cluster]} stopOpacity="0" />
            </radialGradient>
          ))}
          <radialGradient id="halo-comet">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#ffd66b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffd66b" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g ref={world}>
          <g className="sky-sway">
            {rings.map(({ cluster, x, y, radius }) => (
              <g key={cluster} aria-hidden="true">
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill="none"
                  stroke={CLUSTER_COLORS[cluster]}
                  strokeOpacity="0.2"
                  strokeDasharray="1 7"
                  strokeLinecap="round"
                />
                <path
                  id={`arc-${cluster}`}
                  d={`M ${x - radius - 8} ${y} A ${radius + 8} ${radius + 8} 0 0 1 ${x + radius + 8} ${y}`}
                  fill="none"
                />
                <text
                  fill={CLUSTER_COLORS[cluster]}
                  fillOpacity="0.75"
                  fontFamily="Fraunces Variable, Georgia, serif"
                  fontStyle="italic"
                  fontSize="17"
                  letterSpacing="3"
                >
                  <textPath href={`#arc-${cluster}`} startOffset="50%" textAnchor="middle">
                    {CLUSTER_NAMES[cluster]}
                  </textPath>
                </text>
              </g>
            ))}

            {visibleEdges.map((edge) => {
              const from = byId.get(edge.fromId);
              const to = byId.get(edge.toId);
              return (
                <Edge
                  key={edge.id}
                  edge={edge}
                  from={points.get(edge.fromId)!}
                  to={points.get(edge.toId)!}
                  color={from ? CLUSTER_COLORS[from.cluster] : '#fff'}
                  lit={from?.status === 'mastered' && to?.status === 'mastered'}
                  drawing={Boolean(celebration?.edgeIds.includes(edge.id))}
                  onLanded={onLanded}
                />
              );
            })}

            {flares.map(({ key, point }) => (
              <motion.circle
                key={key}
                cx={point.x}
                cy={point.y}
                r="16"
                fill="none"
                stroke="#ffd66b"
                strokeWidth="2"
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                initial={{ scale: 0.4, opacity: 1 }}
                animate={{ scale: 3.6, opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                onAnimationComplete={() =>
                  setFlares((items) => items.filter((item) => item.key !== key))
                }
              />
            ))}

            {sky.concepts.map((concept, index) => {
              const point = points.get(concept.id);
              if (!point) return null;
              const fresh = !seen.current.has(concept.id);
              seen.current.add(concept.id);
              const parent = sky.edges.find((edge) => edge.fromId === concept.id);
              const from = (parent && points.get(parent.toId)) ?? anchorFor(concept.cluster);
              return (
                <Star
                  key={concept.id}
                  concept={concept}
                  status={statusOf(concept.id, concept.status)}
                  point={point}
                  from={from}
                  delay={fresh ? (index % 6) * 0.09 : 0}
                  onOpen={openConcept}
                  onHover={(id, x, y) => setHover(id ? { id, x, y } : null)}
                />
              );
            })}
          </g>
        </g>
      </svg>

      {hover && hovered && (
        <div
          role="tooltip"
          style={{ left: hover.x + 16, top: hover.y + 16 }}
          className="pointer-events-none absolute z-10 max-w-[280px] rounded-md border border-rule bg-panel/95 px-3 py-2"
        >
          <p className="font-display text-base italic">{hovered.title}</p>
          <p className="mt-0.5 text-sm leading-snug text-mist">{hovered.summary}</p>
        </div>
      )}
    </>
  );
}
