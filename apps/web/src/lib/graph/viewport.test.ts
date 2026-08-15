import { describe, expect, it } from 'vitest';
import {
  centreOf,
  magnification,
  pannedTo,
  rewrapped,
  viewportOf,
  zoomedBy,
} from './viewport';

const whole = viewportOf(1000, 640);

describe('viewportOf', () => {
  it('starts as the whole drawing, at 1×', () => {
    expect(whole).toMatchObject({ x: 0, y: 0, width: 1000, height: 640 });
    expect(magnification(whole)).toBe(1);
    expect(centreOf(whole)).toEqual({ x: 500, y: 320 });
  });
});

describe('zoomedBy', () => {
  it('closes in on the point it was given', () => {
    const at = { x: 250, y: 160 };
    const view = zoomedBy(whole, 2, at);

    expect(magnification(view)).toBe(2);
    // The point under the pointer has not moved within the window.
    expect((at.x - view.x) / view.width).toBeCloseTo(0.25, 6);
    expect((at.y - view.y) / view.height).toBeCloseTo(0.25, 6);
  });

  it('keeps the shape of the drawing', () => {
    const view = zoomedBy(whole, 3, { x: 400, y: 300 });
    expect(view.width / view.height).toBeCloseTo(1000 / 640, 6);
  });

  it('never zooms out past the whole graph', () => {
    const view = zoomedBy(zoomedBy(whole, 2), 1 / 100);

    expect(view).toMatchObject({ x: 0, y: 0, width: 1000, height: 640 });
  });

  it('stops zooming in somewhere sane', () => {
    let view = whole;
    for (let step = 0; step < 30; step += 1) view = zoomedBy(view, 2);

    expect(magnification(view)).toBe(12);
  });

  it('stays over the drawing when zooming into a corner', () => {
    const view = zoomedBy(whole, 4, { x: 1000, y: 640 });

    expect(view.x + view.width).toBeCloseTo(1000, 6);
    expect(view.y + view.height).toBeCloseTo(640, 6);
  });
});

describe('pannedTo', () => {
  it('cannot be dragged off the edge of the drawing', () => {
    const view = zoomedBy(whole, 2);

    expect(pannedTo(view, -500, -500)).toMatchObject({ x: 0, y: 0 });
    expect(pannedTo(view, 5000, 5000)).toMatchObject({ x: 500, y: 320 });
  });

  it('does not move a window that already shows everything', () => {
    expect(pannedTo(whole, 300, 300)).toMatchObject({ x: 0, y: 0 });
  });
});

describe('fitting a drawing into the canvas it is given', () => {
  it('takes the shape of the canvas, not of the drawing', () => {
    // A tall drawing shown in a wide canvas.
    const view = viewportOf(400, 1200, 16 / 9);

    expect(view.width / view.height).toBeCloseTo(16 / 9, 6);
    expect(view.height).toBeGreaterThanOrEqual(1200);
    expect(magnification(view)).toBe(1);
  });

  it('centres the drawing on the axis with room to spare', () => {
    const view = viewportOf(400, 1200, 16 / 9);

    // Letterboxed: the window is wider than the drawing, so it is centred
    // rather than pinned to one side.
    expect(view.x + view.width / 2).toBeCloseTo(200, 6);
    expect(view.y).toBeCloseTo(0, 6);
  });

  it('cannot be panned along an axis it already shows whole', () => {
    const view = viewportOf(400, 1200, 16 / 9);

    expect(pannedTo(view, 900, 0).x).toBeCloseTo(view.x, 6);
  });
});

describe('rewrapped', () => {
  it('keeps how far in the reader was when the drawing grows', () => {
    const view = zoomedBy(viewportOf(1000, 640), 4);
    const carried = rewrapped(view, { width: 2000, height: 1280 });

    expect(magnification(carried)).toBeCloseTo(4, 6);
  });

  it('takes the new shape when the canvas is resized', () => {
    const carried = rewrapped(viewportOf(1000, 640), { width: 1000, height: 640 }, 1);

    expect(carried.width / carried.height).toBeCloseTo(1, 6);
  });
});
