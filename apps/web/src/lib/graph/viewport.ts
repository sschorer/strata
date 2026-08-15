/**
 * The window onto the drawing — what panning and zooming actually move.
 *
 * Zooming a graph by re-running its layout is the wrong model: the picture
 * would rearrange itself under the reader every time they leaned in. So the
 * layout is computed once in world coordinates and this is a `viewBox` over
 * it, which the browser scales for free. Kept here as plain values so the
 * clamping — never zoom out past the whole graph, never pan off the edge of
 * it — is one testable thing rather than arithmetic sprinkled through a
 * component's event handlers.
 *
 * The window carries the **shape of the canvas it is shown in**, not the shape
 * of the drawing. A tall graph in a wide canvas is letterboxed — centred, with
 * space either side — because the alternative is stretching the picture or
 * shrinking the canvas to fit it, and both waste the room the page gave us.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The whole drawing this is a window onto. */
  world: { width: number; height: number };
}

/** As far in as the reader may go; 1× is the whole graph and the way back. */
const MAX_ZOOM = 12;

/** The window showing all of a `width × height` drawing, in a canvas of `aspect`. */
export function viewportOf(
  width: number,
  height: number,
  aspect = width / height,
): Viewport {
  const world = { width, height };
  const fitted = fittedWidth(world, aspect);
  return contained({
    x: 0,
    y: 0,
    width: fitted,
    height: fitted / aspect,
    world,
  });
}

/** How much closer this window is than the fitted one. */
export function magnification(view: Viewport): number {
  return fittedWidth(view.world, aspectOf(view)) / view.width;
}

export function centreOf(view: Viewport): Point {
  return { x: view.x + view.width / 2, y: view.y + view.height / 2 };
}

/**
 * Zoom by `factor`, holding `at` — the point under the pointer — still. That
 * is what makes a wheel feel like a magnifier over the picture rather than a
 * slider attached to its middle.
 */
export function zoomedBy(
  view: Viewport,
  factor: number,
  at: Point = centreOf(view),
): Viewport {
  const aspect = aspectOf(view);
  const fitted = fittedWidth(view.world, aspect);
  const width = clamp(view.width / factor, fitted / MAX_ZOOM, fitted);
  const scale = width / view.width;

  return contained({
    ...view,
    x: at.x - (at.x - view.x) * scale,
    y: at.y - (at.y - view.y) * scale,
    width,
    height: width / aspect,
  });
}

/**
 * Carry a window onto a drawing of a different size, or into a canvas of a
 * different shape — what happens when a folder opens, or the page is resized.
 * The window keeps how far in it was; only what it can reach changes.
 */
export function rewrapped(
  view: Viewport,
  world: { width: number; height: number },
  aspect = aspectOf(view),
): Viewport {
  const zoom = magnification(view);
  const fitted = fittedWidth(world, aspect);
  const width = clamp(fitted / zoom, fitted / MAX_ZOOM, fitted);
  const middle = centreOf(view);

  return contained({
    ...view,
    world,
    x: middle.x - width / 2,
    y: middle.y - width / aspect / 2,
    width,
    height: width / aspect,
  });
}

/** Move the window's corner, keeping it over the drawing. */
export function pannedTo(view: Viewport, x: number, y: number): Viewport {
  return contained({ ...view, x, y });
}

/**
 * Hold the window over the drawing. On an axis where the window is the larger
 * of the two there is nothing to pan along, so the drawing is centred in it
 * instead — which is what letterboxing a tall graph in a wide canvas means.
 */
function contained(view: Viewport): Viewport {
  return {
    ...view,
    x: hold(view.x, view.width, view.world.width),
    y: hold(view.y, view.height, view.world.height),
  };
}

function hold(value: number, window: number, world: number): number {
  if (window >= world) return (world - window) / 2;
  return clamp(value, 0, world - window);
}

const aspectOf = (view: Viewport) => view.width / view.height;

/** The window width that just contains the drawing at this shape. */
function fittedWidth(
  world: { width: number; height: number },
  aspect: number,
): number {
  return Math.max(world.width, world.height * aspect);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
