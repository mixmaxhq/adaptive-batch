import adaptiveBatch from '../src';
import { defer } from 'promise-callbacks';

describe('adaptiveBatch', () => {
  it('should support multiple concurrent invocations', async () => {
    const d1 = defer(),
      d2 = defer();
    const getter = jest
      .fn()
      .mockResolvedValueOnce(d1.promise)
      .mockResolvedValueOnce(d2.promise);

    const get = adaptiveBatch(getter);

    const g1 = get('noot1');
    const g2 = get('noot2');

    expect(getter).toHaveBeenCalledTimes(1);
    expect([...getter.mock.calls[0][0]]).toEqual(['noot1']);

    d1.resolve(new Map([['noot1', 'noot1-0']]));
    await expect(g1).resolves.toBe('noot1-0');

    expect(getter).toHaveBeenCalledTimes(2);
    expect([...getter.mock.calls[1][0]]).toEqual(['noot2']);

    d2.resolve(new Map([['noot2', 'noot2-0']]));
    await expect(g2).resolves.toBe('noot2-0');

    expect(getter).toHaveBeenCalledTimes(2);
  });

  it('should increase concurrency when max queue is met', async () => {
    const d1 = defer(),
      d2 = defer();
    const getter = jest
      .fn()
      .mockResolvedValueOnce(d1.promise)
      .mockResolvedValueOnce(d2.promise);

    const get = adaptiveBatch(getter, { maxQueued: 1 });

    const g1 = get('noot1');
    const g2 = get('noot2');

    expect(getter).toHaveBeenCalledTimes(2);
    expect([...getter.mock.calls[0][0]]).toEqual(['noot1']);
    expect([...getter.mock.calls[1][0]]).toEqual(['noot2']);

    d1.resolve(new Map([['noot1', 'noot1-0']]));
    await expect(g1).resolves.toBe('noot1-0');

    d2.resolve(new Map([['noot2', 'noot2-0']]));
    await expect(g2).resolves.toBe('noot2-0');

    expect(getter).toHaveBeenCalledTimes(2);
  });

  it('should cache values', async () => {
    const d = defer();
    const getter = jest.fn().mockResolvedValueOnce(d.promise);

    const get = adaptiveBatch(getter, { permanentCache: false });

    const g1 = get('noot1');
    const g2 = get('noot1');

    expect(getter).toHaveBeenCalledTimes(1);
    expect([...getter.mock.calls[0][0]]).toEqual(['noot1']);

    d.resolve(new Map([['noot1', 'noot1-0']]));
    await expect(g1).resolves.toBe('noot1-0');
    await expect(g2).resolves.toBe('noot1-0');

    expect(getter).toHaveBeenCalledTimes(1);
  });

  it('should permanently cache values', async () => {
    const d = defer();
    const getter = jest.fn().mockResolvedValueOnce(d.promise);

    const get = adaptiveBatch(getter);

    const g1 = get('noot1');

    expect(getter).toHaveBeenCalledTimes(1);
    expect([...getter.mock.calls[0][0]]).toEqual(['noot1']);

    d.resolve(new Map([['noot1', 'noot1-0']]));
    await expect(g1).resolves.toBe('noot1-0');

    const g2 = get('noot1');

    await expect(g2).resolves.toBe('noot1-0');

    expect(getter).toHaveBeenCalledTimes(1);
  });

  it('should process fewer than the max batch', async () => {
    const d1 = defer();
    const getter = jest
      .fn()
      .mockResolvedValueOnce(d1.promise)
      .mockResolvedValueOnce(new Promise(() => {}));

    const get = adaptiveBatch(getter, { maxBatch: 1 });

    const g1 = get('noot1');
    get('noot2');
    get('noot3');

    expect(getter).toHaveBeenCalledTimes(1);
    expect([...getter.mock.calls[0][0]]).toEqual(['noot1']);

    d1.resolve(new Map([['noot1', 'noot1-0']]));
    await expect(g1).resolves.toBe('noot1-0');

    expect(getter).toHaveBeenCalledTimes(2);
    expect([...getter.mock.calls[1][0]]).toEqual(['noot2']);
  });

  it('should handle hundreds of concurrent requests', async () => {
    // Wait a microtick, then convert the emails to upper case. Keep track of the
    // total number of emails we process for verification later.
    let totalProcessed = 0;
    const getter = async (emailsIt) => {
      const emails = [...emailsIt];
      await Promise.resolve();
      totalProcessed += emails.length;
      return new Map(emails.map((email) => [email, email.toUpperCase()]));
    };

    const get = adaptiveBatch(getter, {
      maxBatch: 100,
      maxConcurrent: 8,
      maxQueued: 32,
    });

    const numEmails = 500;
    const emails = Array(numEmails)
      .fill(null)
      .map((_, idx) => `doot${idx}@noot.com`);

    const upperEmailPromises = emails.map(get).map((upperEmailPromise, idx) => {
      const email = emails[idx];
      return upperEmailPromise.then((upperEmail) => {
        expect(email.toUpperCase()).toEqual(upperEmail);
      });
    });

    await Promise.all(upperEmailPromises);
    expect(totalProcessed).toEqual(numEmails);
  });

  it('should fall back to erroring', async () => {
    const d1 = defer(),
      d2 = defer();
    const getter = jest
      .fn()
      .mockResolvedValueOnce(d1.promise)
      .mockResolvedValueOnce(d2.promise);

    const get = adaptiveBatch(getter);

    const g1 = get('noot1');
    const g2 = get('noot2');
    const g3 = get('noot3');

    expect(getter).toHaveBeenCalledTimes(1);
    expect([...getter.mock.calls[0][0]]).toEqual(['noot1']);

    d1.resolve(new Map([['noot1', 'noot1-0']]));
    await expect(g1).resolves.toBe('noot1-0');

    d2.resolve(new Map([['noot2', 'noot2-0']]));
    await expect(g2).resolves.toBe('noot2-0');
    await expect(g3).rejects.toThrow(/not retrieved/);

    expect(getter).toHaveBeenCalledTimes(2);
    expect([...getter.mock.calls[1][0]]).toEqual(['noot2', 'noot3']);
  });

  it('should fall back to the provided missing value', async () => {
    const d1 = defer(),
      d2 = defer();
    const getter = jest
      .fn()
      .mockResolvedValueOnce(d1.promise)
      .mockResolvedValueOnce(d2.promise);

    const beep = {};
    const get = adaptiveBatch(getter, { missingValue: beep });

    const g1 = get('noot1');
    const g2 = get('noot2');
    const g3 = get('noot3');

    expect(getter).toHaveBeenCalledTimes(1);
    expect([...getter.mock.calls[0][0]]).toEqual(['noot1']);

    d1.resolve(new Map([['noot1', 'noot1-0']]));
    await expect(g1).resolves.toBe('noot1-0');

    d2.resolve(new Map([['noot2', 'noot2-0']]));
    await expect(g2).resolves.toBe('noot2-0');
    await expect(g3).resolves.toBe(beep);

    expect(getter).toHaveBeenCalledTimes(2);
    expect([...getter.mock.calls[1][0]]).toEqual(['noot2', 'noot3']);
  });

  it('should fail appropriately when the getter returns a non-Map', async () => {
    const d1 = defer(),
      d2 = defer();
    const getter = jest
      .fn()
      .mockResolvedValueOnce(d1.promise)
      .mockResolvedValueOnce(d2.promise);

    const get = adaptiveBatch(getter);

    const g1 = get('noot1');
    const g2 = get('noot2');

    expect(getter).toHaveBeenCalledTimes(1);
    expect([...getter.mock.calls[0][0]]).toEqual(['noot1']);

    d1.resolve({ noot1: 'noot1-0' });
    await expect(g1).rejects.toThrow(/Map/);

    // recovery
    d2.resolve(new Map([['noot2', 'noot2-0']]));
    await expect(g2).resolves.toBe('noot2-0');

    expect(getter).toHaveBeenCalledTimes(2);
    expect([...getter.mock.calls[1][0]]).toEqual(['noot2']);
  });

  it('should appropriately throw errors from has/get', async () => {
    const d1 = defer(),
      d2 = defer();
    const getter = jest
      .fn()
      .mockResolvedValueOnce(d1.promise)
      .mockResolvedValueOnce(d2.promise);

    const get = adaptiveBatch(getter);

    const g1 = get('noot1');
    const g2 = get('noot2');

    expect(getter).toHaveBeenCalledTimes(1);
    expect([...getter.mock.calls[0][0]]).toEqual(['noot1']);

    d1.resolve({
      get(k) {
        return `${k}-0`;
      },
      has(k) {
        if (k === 'noot1') {
          throw new Error('special exception');
        }
        return true;
      },
    });
    await expect(g1).rejects.toThrow(/special exception/);

    // recovery
    d2.resolve(new Map([['noot2', 'noot2-0']]));
    await expect(g2).resolves.toBe('noot2-0');

    expect(getter).toHaveBeenCalledTimes(2);
    expect([...getter.mock.calls[1][0]]).toEqual(['noot2']);
  });
});
