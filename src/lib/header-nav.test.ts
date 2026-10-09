import { describe, it, expect } from 'vitest';
import { splitCenteredNav } from './header-nav';

// The primary navigation as rendered by the storefront header (7 items).
const NAV = [
  'shop',
  'shop?sort=newest',
  'collections',
  'shop?kind=ready',
  'collections/made-to-order',
  'about',
  'size-guide',
];

describe('splitCenteredNav', () => {
  it('splits 7 items into 3 left and 4 right by default', () => {
    const { left, right } = splitCenteredNav(NAV);
    expect(left).toHaveLength(3);
    expect(right).toHaveLength(4);
  });

  it('takes the first three as the left group, in order', () => {
    expect(splitCenteredNav(NAV).left).toEqual(['shop', 'shop?sort=newest', 'collections']);
  });

  it('places the remaining items on the right, in order', () => {
    expect(splitCenteredNav(NAV).right).toEqual([
      'shop?kind=ready',
      'collections/made-to-order',
      'about',
      'size-guide',
    ]);
  });

  it('preserves every item exactly once across both groups', () => {
    const { left, right } = splitCenteredNav(NAV);
    expect([...left, ...right]).toEqual(NAV);
  });

  it('honours a custom split point', () => {
    const { left, right } = splitCenteredNav(NAV, 2);
    expect(left).toHaveLength(2);
    expect(right).toHaveLength(5);
  });

  it('clamps the left count to the number of items', () => {
    const { left, right } = splitCenteredNav(['a', 'b'], 3);
    expect(left).toEqual(['a', 'b']);
    expect(right).toEqual([]);
  });

  it('handles an empty list', () => {
    expect(splitCenteredNav([])).toEqual({ left: [], right: [] });
  });

  it('is non-destructive: the input array is unchanged', () => {
    const input = [...NAV];
    splitCenteredNav(input);
    expect(input).toEqual(NAV);
  });
});
