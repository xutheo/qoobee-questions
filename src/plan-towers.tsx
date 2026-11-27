import React, { useLayoutEffect, useRef } from 'react';
import { towerValue, type TowerMotion } from '../shared/plan';

function blockColor(block: string) {
  if (block.startsWith('+')) return 'addition';
  if (block.startsWith('−') || block.startsWith('-')) return 'subtraction';
  if (block.startsWith('×')) return 'multiplication';
  return 'number';
}

/** Animate from the old layout to the new one, including moves between stacks. */
export function PlanTowers({ stacks, motion }: { stacks: string[][]; motion?: TowerMotion }) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<string, DOMRect>());
  const lastMotion = useRef('');
  const animations = useRef<Animation[]>([]);
  const layoutKey = JSON.stringify(stacks);
  const motionKey = JSON.stringify(motion);

  useLayoutEffect(() => {
    const elements = [...root.current!.querySelectorAll<HTMLElement>('[data-block]')];
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
    const next = new Map(elements.map(element => [element.dataset.block!, element.getBoundingClientRect()]));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      for (const element of elements) {
        const block = element.dataset.block!;
        const before = previous.current.get(block), after = next.get(block)!;
        if (!before) continue;
        const x = before.left - after.left, y = before.top - after.top;
        const flipped = motionKey !== lastMotion.current && motion?.flip && motion.blocks.includes(block);
        if (Math.abs(x) < 1 && Math.abs(y) < 1 && !flipped) continue;
        const first = `translate(${x}px, ${y}px) scale(${before.width / after.width}, ${before.height / after.height})`;
        const middle = `translate(${x / 2}px, ${y / 2 - 24}px)${flipped ? ' rotateY(180deg)' : ''}`;
        animations.current.push(element.animate([
          { transform: first, zIndex: 2, boxShadow: '0 8px 22px #0006' },
          { transform: middle, zIndex: 2, offset: 0.5, boxShadow: '0 12px 28px #0008' },
          { transform: flipped ? 'rotateY(360deg)' : 'none', zIndex: 2, boxShadow: '0 0 0 #0000' },
        ], { duration: 650, easing: 'cubic-bezier(.22,.68,.22,1)' }));
      }
    }
    previous.current = next;
    lastMotion.current = motionKey;
  }, [layoutKey, motionKey]);

  useLayoutEffect(() => () => animations.current.forEach(animation => animation.cancel()), []);

  return <div className="plan-towers" ref={root}>
    {stacks.map((stack, i) => <div key={i}>
      <h3>Stack {i + 1}</h3>
      <div className="plan-stack" style={{ '--stack-depth': Math.max(1, ...stacks.map(s => s.length)) } as React.CSSProperties}>
        {stack.map(block => <div key={block} data-block={block} className={`plan-block block-${blockColor(block)}`}>{block}</div>)}
      </div>
      <small>{towerValue(stack) ?? '—'}</small>
    </div>)}
  </div>;
}
