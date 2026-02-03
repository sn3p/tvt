export class AbortError extends Error {
  constructor(message = "Aborted") {
    super(message);
    this.name = "AbortError";
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new AbortError();
}

/**
 * Run async jobs with a concurrency limit.
 *
 * @template TIn, TOut
 * @param {TIn[]} items
 * @param {number} concurrency
 * @param {(item: TIn, index: number) => Promise<TOut>} worker
 * @param {{ signal?: AbortSignal, onProgress?: (p: {done: number, total: number}) => void }} opts
 * @returns {Promise<PromiseSettledResult<TOut>[]>}
 */
export async function promisePool(items, concurrency, worker, opts = {}) {
  const { signal, onProgress } = opts;
  const total = items.length;
  let done = 0;

  const results = new Array(total);
  let nextIdx = 0;

  async function runOne() {
    while (true) {
      throwIfAborted(signal);
      const idx = nextIdx++;
      if (idx >= total) return;
      try {
        const value = await worker(items[idx], idx);
        results[idx] = { status: "fulfilled", value };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      } finally {
        done += 1;
        onProgress?.({ done, total });
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runOne());
  await Promise.all(workers);
  return results;
}

