import { CLUSTERS, type Cluster, type ConceptView, type EdgeView } from '@curio/core';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force';

export type Point = { x: number; y: number };

type StarNode = SimulationNodeDatum & { id: string; home: Point };
type StarLink = { source: string; target: string; kind: EdgeView['kind'] };

const ANCHOR_RADIUS = 620;
const TOPIC_SPREAD = 390;
const GOLDEN_ANGLE = 2.4;
const SETTLE_TICKS = 300;
// Wide enough for a two-line label, which is broader than the star.
const STAR_SPACING = 80;

export function anchorFor(cluster: Cluster): Point {
  const angle = (CLUSTERS.indexOf(cluster) / CLUSTERS.length) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * ANCHOR_RADIUS * 1.35, y: Math.sin(angle) * ANCHOR_RADIUS };
}

/** Each topic gets its own patch of its cluster, so topics don't interleave. */
function topicHomes(concepts: ConceptView[]): Map<string, Point> {
  const homes = new Map<string, Point>();
  const perCluster = new Map<Cluster, number>();
  for (const concept of concepts) {
    if (homes.has(concept.topicId)) continue;
    const index = perCluster.get(concept.cluster) ?? 0;
    perCluster.set(concept.cluster, index + 1);
    const anchor = anchorFor(concept.cluster);
    const reach = index === 0 ? 0 : TOPIC_SPREAD * Math.sqrt(index);
    homes.set(concept.topicId, {
      x: anchor.x + Math.cos(index * GOLDEN_ANGLE) * reach,
      y: anchor.y + Math.sin(index * GOLDEN_ANGLE) * reach,
    });
  }
  return homes;
}

/**
 * Lays out the sky with a force simulation, run to rest off-screen. Stars that
 * already have a place are pinned, so the map never jumps when new ones arrive.
 */
export function layoutSky(
  concepts: ConceptView[],
  edges: EdgeView[],
  previous: Map<string, Point>,
): Map<string, Point> {
  const ids = new Set(concepts.map((concept) => concept.id));
  const homes = topicHomes(concepts);
  const links: StarLink[] = edges
    .filter((edge) => ids.has(edge.fromId) && ids.has(edge.toId))
    .map((edge) => ({ source: edge.fromId, target: edge.toId, kind: edge.kind }));

  const nodes: StarNode[] = concepts.map((concept, index) => {
    const home = homes.get(concept.topicId)!;
    const placed = previous.get(concept.id);
    if (placed) return { id: concept.id, home, ...placed, fx: placed.x, fy: placed.y };
    return {
      id: concept.id,
      home,
      x: home.x + Math.cos(index * GOLDEN_ANGLE) * 40,
      y: home.y + Math.sin(index * GOLDEN_ANGLE) * 40,
    };
  });

  forceSimulation(nodes)
    .force(
      'link',
      forceLink<StarNode, StarLink>(links)
        .id((node) => node.id)
        .distance((link) => (link.kind === 'within' ? 150 : 360))
        .strength((link) => (link.kind === 'within' ? 0.6 : 0.01)),
    )
    .force('charge', forceManyBody().strength(-420))
    .force('collide', forceCollide(STAR_SPACING))
    .force('x', forceX<StarNode>((node) => node.home.x).strength(0.1))
    .force('y', forceY<StarNode>((node) => node.home.y).strength(0.1))
    .stop()
    .tick(SETTLE_TICKS);

  return new Map(nodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
}

/** A gentle curve between two stars. */
export function edgePath(from: Point, to: Point): string {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const bend = 0.14;
  const controlX = midX - (to.y - from.y) * bend;
  const controlY = midY + (to.x - from.x) * bend;
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}
