// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Daisy from './Daisy';
import { STAGES, stageFor } from './lib/daisy';

// vitest globals are off, so cleanup is explicit or the second render finds two.
afterEach(cleanup);

const stage = (n: number) => STAGES[n - 1];

describe('<Daisy/>', () => {
  it('is a seed on a fresh install, and says so in text as well as in art', () => {
    render(<Daisy stage={stageFor(0)} coverage={0} depth={0} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toMatch(/nothing|seed/i);
    expect(screen.getByText(/I\. Seed/)).toBeTruthy();
  });

  it('draws a different plate for each stage', () => {
    // Element counts collide between stages, so compare the drawings themselves:
    // this is what actually proves no stage silently renders its neighbour's art.
    const drawings = STAGES.map((s) => {
      cleanup();
      const { container } = render(<Daisy stage={s} coverage={s.min} depth={s.min / 3} />);
      return container.querySelector('svg')?.innerHTML ?? '';
    });
    expect(new Set(drawings).size).toBe(STAGES.length);
    expect(drawings.every((d) => d.length > 0)).toBe(true);
  });

  it('grows: a later stage is drawn with strictly more parts than an earlier one', () => {
    const count = (n: number) => {
      cleanup();
      const { container } = render(<Daisy stage={stage(n)} coverage={0.5} depth={0.2} />);
      return container.querySelectorAll('path, ellipse, circle').length;
    };
    const seed = count(1);
    const bud = count(5);
    const bloom = count(7);
    expect(bud).toBeGreaterThan(seed);
    expect(bloom).toBeGreaterThan(bud);
  });

  it('states THE dangerous state — grew tall, did not flower — in words', () => {
    render(<Daisy stage={stage(7)} coverage={1} depth={0.34} />);
    const label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/not opened|barely/i);
    expect(label).not.toMatch(/mastered everything/i);
  });

  it('keeps the sage ground, because the rays are only legible against it', () => {
    const { container } = render(<Daisy stage={stage(7)} coverage={1} depth={1} />);
    // querySelector('rect') would find the clip path's rect, which has no fill.
    const ground = container.querySelector('rect[fill]');
    expect(ground?.getAttribute('fill')).toBe('var(--c-plate)');
    // And the whole plate is clipped, so the soil band keeps the rounded corner.
    expect(container.querySelector('[clip-path]')).toBeTruthy();
  });

  it('gives every stage the same frame, so the plant grows inside a fixed sky', () => {
    const boxes = STAGES.map((s) => {
      cleanup();
      const { container } = render(<Daisy stage={s} coverage={0} depth={0} />);
      return container.querySelector('svg')?.getAttribute('viewBox');
    });
    expect(new Set(boxes).size).toBe(1);
  });

  // REGRESSION. The plates are authored with fill="none" on the root and 48 of
  // their paths carry only a stroke. SVG defaults fill to BLACK, so dropping
  // that one attribute fills every petal vein and every root solid black — the
  // flower still renders, tests still pass, and it just looks wrong. Nothing
  // else in the suite would have caught it.
  it('keeps fill="none" on the root, or every stroke-only path fills black', () => {
    const { container } = render(<Daisy stage={stage(7)} coverage={1} depth={1} />);
    expect(container.querySelector('svg')?.getAttribute('fill')).toBe('none');
  });

  it('leaves every vein and root unfilled', () => {
    const { container } = render(<Daisy stage={stage(7)} coverage={1} depth={1} />);
    const strokeOnly = [...container.querySelectorAll('path[stroke]')].filter(
      (el) => !el.getAttribute('fill')
    );
    // They exist (the veins are what model the rays) and none of them sets a
    // fill of its own, so all of them inherit "none" from the root.
    expect(strokeOnly.length).toBeGreaterThan(20);
  });

  it('exposes one live text equivalent rather than relying on the drawing', () => {
    render(<Daisy stage={stage(4)} coverage={0.3} depth={0.1} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBeTruthy();
  });

  it('drops the caption when compact, but never the accessible label', () => {
    const { container } = render(<Daisy stage={stage(4)} coverage={0.3} depth={0.1} compact />);
    expect(container.querySelector('figcaption')).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBeTruthy();
  });
});
