import { describe, expect, it } from 'vitest';
import { ProceduralCity, RouteFollower } from './procMap';

describe('ProceduralCity / RouteFollower', () => {
  it('is deterministic', () => {
    const a = new RouteFollower(new ProceduralCity(1), 2);
    const b = new RouteFollower(new ProceduralCity(1), 2);
    a.advance(2500);
    b.advance(2500);
    expect(a.position).toEqual(b.position);
    expect(a.street).toBe(b.street);
  });

  it('moves continuously and stays inside the city', () => {
    const city = new ProceduralCity(4);
    const r = new RouteFollower(city, 9);
    let prev = r.position;
    const extent = city.n * city.spacing;
    for (let i = 0; i < 2000; i++) {
      r.advance(10);
      const p = r.position;
      expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(10.5);
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(extent);
      expect(p.y).toBeLessThan(extent);
      prev = p;
    }
  });

  it('reports an upcoming turn with a positive distance', () => {
    const r = new RouteFollower(new ProceduralCity(), 5);
    const t = r.nextTurn();
    expect(t.distanceM).toBeGreaterThan(0);
    expect(['left', 'right', 'straight']).toContain(t.direction);
    expect(t.street.length).toBeGreaterThan(0);
  });
});
