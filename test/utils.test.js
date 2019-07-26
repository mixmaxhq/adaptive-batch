import { extractFrom } from '../src/utils';

describe('extractFrom', () => {
  it('should function on empty maps', () => {
    const map = new Map();
    const [m1, m2] = extractFrom(map, 1);
    expect(m1).not.toBe(map);
    expect(m2).not.toBe(map);
    expect(m1).not.toBe(m2);
    expect(map).toHaveProperty('size', 0);
    expect(m1).toEqual(map);
    expect(m2).toEqual(map);
  });

  it('should drain the given map', () => {
    const map = new Map([[1, 2]]);
    const [m1, m2] = extractFrom(map, 3);
    expect(map).toHaveProperty('size', 1);
    expect(m1).toHaveProperty('size', 0);
    expect(m2).toHaveProperty('size', 1);
    expect(m2).toEqual(map);
  });

  it('should partially drain the given map', () => {
    const map = new Map([[1, 2], [3, 4]]);
    const [m1, m2] = extractFrom(map, 1);
    expect(map).toHaveProperty('size', 2);
    expect(m1).toHaveProperty('size', 1);
    expect(m2).toHaveProperty('size', 1);
    expect(new Map([...m1.entries(), ...m2.entries()])).toEqual(map);
  });
});
