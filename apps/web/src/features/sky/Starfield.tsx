import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';

const LAYERS = [
  { stars: 420, size: 0.7, alpha: 0.4, shift: 6 },
  { stars: 170, size: 1.1, alpha: 0.6, shift: 14 },
  { stars: 46, size: 1.6, alpha: 0.85, shift: 26 },
];

/** Small seeded generator, so the background sky is the same on every visit. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function Layer({
  layer,
  index,
  pointerX,
  pointerY,
}: {
  layer: (typeof LAYERS)[number];
  index: number;
  pointerX: ReturnType<typeof useSpring>;
  pointerY: ReturnType<typeof useSpring>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const x = useTransform(pointerX, (value) => value * layer.shift);
  const y = useTransform(pointerY, (value) => value * layer.shift);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    element.width = window.innerWidth * 1.1;
    element.height = window.innerHeight * 1.1;
    const random = seeded(index + 7);
    for (let star = 0; star < layer.stars; star += 1) {
      context.globalAlpha = layer.alpha * (0.4 + random() * 0.6);
      context.fillStyle = random() > 0.85 ? '#c9d4ff' : '#ffffff';
      context.beginPath();
      context.arc(random() * element.width, random() * element.height, layer.size, 0, Math.PI * 2);
      context.fill();
    }
  }, [index, layer]);

  return (
    <motion.canvas
      ref={canvas}
      aria-hidden="true"
      style={{ x, y }}
      className="pointer-events-none absolute -top-[5%] -left-[5%] h-[110%] w-[110%]"
    />
  );
}

/** The distant sky, in three depths that shift with the pointer. */
export function Starfield() {
  const reduced = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const pointerX = useSpring(rawX, { stiffness: 40, damping: 18 });
  const pointerY = useSpring(rawY, { stiffness: 40, damping: 18 });

  useEffect(() => {
    if (reduced) return;
    const onMove = (event: PointerEvent) => {
      rawX.set(0.5 - event.clientX / window.innerWidth);
      rawY.set(0.5 - event.clientY / window.innerHeight);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [rawX, rawY, reduced]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {LAYERS.map((layer, index) => (
        <Layer key={index} layer={layer} index={index} pointerX={pointerX} pointerY={pointerY} />
      ))}
    </div>
  );
}
