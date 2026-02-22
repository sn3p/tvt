function toRequestError(message, code = "worker_error") {
  const err = new Error(String(message || "Worker cluster request failed"));
  err.code = code;
  return err;
}

export class WorkerClusterSource {
  constructor({ workerUrl } = {}) {
    this.workerUrl = workerUrl || new URL("./workers/cluster.worker.js", import.meta.url);
    this.worker = null;
    this.ready = false;
    this.readyPromise = null;
    this.pending = new Map();
    this.requestSeq = 0;
    this.lastPointSignature = "";
    this.destroyed = false;
    this.setPointsTimer = 0;
    this.setPointsWaiters = [];
    this.setPointsPayload = null;
  }

  async ensureReady() {
    if (this.destroyed) throw toRequestError("WorkerClusterSource is destroyed", "destroyed");
    if (this.ready) return;
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise((resolve, reject) => {
      try {
        const worker = new Worker(String(this.workerUrl));
        this.worker = worker;

        worker.onmessage = (event) => {
          const msg = event?.data || {};
          const type = String(msg?.type || "");

          if (type === "ready") {
            this.ready = true;
            resolve();
            return;
          }

          const requestId = Number(msg?.requestId || 0);
          if (!requestId || !this.pending.has(requestId)) return;
          const pending = this.pending.get(requestId);
          this.pending.delete(requestId);

          if (type === "error") {
            pending.reject(toRequestError(msg?.message || "Worker returned an error", "worker_error"));
            return;
          }

          pending.resolve(msg);
        };

        worker.onerror = (event) => {
          const err = toRequestError(event?.message || "Cluster worker crashed", "worker_crash");
          for (const [, pending] of this.pending) pending.reject(err);
          this.pending.clear();
          reject(err);
          this.readyPromise = null;
          this.ready = false;
        };
      } catch (err) {
        reject(err);
      }
    });

    return this.readyPromise;
  }

  async request(type, payload = {}) {
    await this.ensureReady();
    if (!this.worker) throw toRequestError("Cluster worker not available", "worker_missing");

    const requestId = ++this.requestSeq;
    const req = new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
    });

    this.worker.postMessage({
      type,
      requestId,
      ...payload,
    });
    return req;
  }

  async setPoints(points, { signature = "", force = false, debounceMs = 250, options = null } = {}) {
    const nextSignature = String(signature || "");
    if (!force && nextSignature && nextSignature === this.lastPointSignature) {
      return;
    }

    const payload = {
      points: Array.isArray(points) ? points : [],
      signature: nextSignature,
      force: Boolean(force),
      options,
    };

    const runInitNow = async () => {
      const currentPayload = this.setPointsPayload || payload;
      this.setPointsPayload = null;
      const res = await this.request("init", {
        points: currentPayload.points,
        options: currentPayload.options || undefined,
      });
      this.lastPointSignature = currentPayload.signature;
      return res;
    };

    const waitForResult = () =>
      new Promise((resolve, reject) => {
        this.setPointsWaiters.push({ resolve, reject });
      });

    const flushWaiters = (err, value) => {
      const waiters = this.setPointsWaiters.slice();
      this.setPointsWaiters = [];
      for (const waiter of waiters) {
        if (err) waiter.reject(err);
        else waiter.resolve(value);
      }
    };

    if (debounceMs <= 0) {
      try {
        const res = await runInitNow();
        flushWaiters(null, res);
        return res;
      } catch (err) {
        flushWaiters(err);
        throw err;
      }
    }

    this.setPointsPayload = payload;
    const promise = waitForResult();

    if (this.setPointsTimer) {
      clearTimeout(this.setPointsTimer);
      this.setPointsTimer = 0;
    }

    this.setPointsTimer = setTimeout(async () => {
      this.setPointsTimer = 0;
      try {
        const res = await runInitNow();
        flushWaiters(null, res);
      } catch (err) {
        flushWaiters(err);
      }
    }, Math.max(0, Number(debounceMs) || 0));

    return promise;
  }

  async getClusters({ bbox, zoom }) {
    const res = await this.request("query", { bbox, zoom });
    return Array.isArray(res?.clusters) ? res.clusters : [];
  }

  async getLeaves({ clusterId, limit = 100, offset = 0 }) {
    const res = await this.request("leaves", { clusterId, limit, offset });
    return Array.isArray(res?.leaves) ? res.leaves : [];
  }

  async getClusterExpansionZoom(clusterId) {
    const res = await this.request("expansionZoom", { clusterId });
    const zoom = Number(res?.zoom);
    return Number.isFinite(zoom) ? zoom : null;
  }

  destroy() {
    this.destroyed = true;
    if (this.setPointsTimer) {
      clearTimeout(this.setPointsTimer);
      this.setPointsTimer = 0;
    }
    this.setPointsPayload = null;
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // ignore
      }
    }
    this.worker = null;
    this.ready = false;
    this.readyPromise = null;
    this.lastPointSignature = "";
    for (const waiter of this.setPointsWaiters) {
      waiter.reject(toRequestError("Worker destroyed", "destroyed"));
    }
    this.setPointsWaiters = [];
    for (const [, pending] of this.pending) {
      pending.reject(toRequestError("Worker destroyed", "destroyed"));
    }
    this.pending.clear();
  }
}
