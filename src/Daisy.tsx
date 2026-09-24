import { describeDaisy, type Stage } from './lib/daisy';
import { ART_VIEWBOX, plateFor } from './DaisyArt';

/**
 * The daisy (design.md 19). Overall progress as a life cycle.
 *
 * WHAT CHANGED. This used to draw the plant procedurally: rays were Parts,
 * sectors were subjects, leaf size was exam weight, scape height was coverage
 * and bloom openness was depth. It is now seven drawn plates, chosen by stage.
 *
 * The cost is real and worth stating plainly: the head no longer encodes WHICH
 * Parts are open, so hovering a ray can no longer name a subject. Per-subject
 * detail still exists — it is on the six cards around the plant and in the
 * meters — but it is no longer in the flower.
 *
 * What survives is the part that mattered most: stage is ratcheted, so the
 * plant never wilts, and the caption still separates coverage from depth. A
 * bloom that is wide open and shallow still says so in words.
 */

interface Props {
  /** Already ratcheted by the caller. Passing it in rather than recomputing it
   *  here means there is exactly one high-water mark in the app, not two. */
  stage: Stage;
  coverage: number;
  depth: number;
  /** Drop the caption — the ring shows the plant alone in the middle, and a
   *  caption there pushes it off centre. */
  compact?: boolean;
}

export default function Daisy({ stage, coverage, depth, compact = false }: Props) {
  const Plate = plateFor(stage.n);
  const description = describeDaisy(stage, coverage, depth);

  return (
    <figure className="m-0 flex flex-col items-center">
      <svg
        viewBox={ART_VIEWBOX}
        // The plates are authored with fill="none" on the root, and 48 of their
        // paths carry only a stroke. SVG defaults fill to BLACK, not none, so
        // dropping this attribute fills every petal vein and every root solid
        // black. It is load-bearing, not boilerplate.
        fill="none"
        role="img"
        aria-label={description}
        className="h-auto w-full"
      >
        <defs>
          {/* The soil band runs to the bottom edge, so rounding the ground rect
              is not enough — without this the band keeps square corners and
              hangs out of the plate. Clip once, round everything. */}
          <clipPath id="daisy-plate-clip">
            <rect width="320" height="460" rx="16" />
          </clipPath>
        </defs>
        <g clipPath="url(#daisy-plate-clip)">
          {/* The sage ground is part of the drawing. White rays cannot be told
              apart from the page's sand; against this they can. See index.css. */}
          <rect width="320" height="460" fill="var(--c-plate)" />
          {/* Keyed by stage so a promotion fades the new plate in rather than
              swapping it. 240ms — a plant changing state should be noticed. */}
          <g key={stage.n} className="animate-fade">
            <Plate />
          </g>
        </g>
      </svg>

      {!compact && (
        <figcaption className="mt-3 max-w-xs text-center text-xs leading-relaxed text-ink-muted">
          <span className="font-semibold text-heading">
            {stage.roman}. {stage.name}
          </span>{' '}
          — {description}
        </figcaption>
      )}
    </figure>
  );
}
