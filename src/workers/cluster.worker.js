/* global Supercluster */

self.importScripts("https://unpkg.com/supercluster@8.0.1/dist/supercluster.min.js");

const DEFAULT_CLUSTER_OPTIONS = {
  radius: 80,
  maxZoom: 16,
  minPoints: 2,
};

let index = null;

function postResponse(type, requestId, payload = {}) {
  self.postMessage({
    type,
    requestId,
    ...payload,
  });
}

function normalizeZoom(zoom) {
  const n = Number(zoom);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(22, Math.round(n)));
}

function normalizeBBox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return [-180, -85, 180, 85];
  const west = Number(bbox[0]);
  const south = Number(bbox[1]);
  const east = Number(bbox[2]);
  const north = Number(bbox[3]);
  if (![west, south, east, north].every(Number.isFinite)) return [-180, -85, 180, 85];
  return [west, south, east, north];
}

function normalizeClusterOptions(options) {
  const radius = Number(options?.radius);
  const maxZoom = Number(options?.maxZoom);
  const minPoints = Number(options?.minPoints);

  return {
    radius: Number.isFinite(radius) ? Math.max(1, Math.min(200, Math.round(radius))) : DEFAULT_CLUSTER_OPTIONS.radius,
    maxZoom: Number.isFinite(maxZoom) ? Math.max(0, Math.min(22, Math.round(maxZoom))) : DEFAULT_CLUSTER_OPTIONS.maxZoom,
    minPoints: Number.isFinite(minPoints) ? Math.max(2, Math.min(100, Math.round(minPoints))) : DEFAULT_CLUSTER_OPTIONS.minPoints,
  };
}

function buildIndex(points, options) {
  const normalizedOptions = normalizeClusterOptions(options);
  const SuperclusterCtor = self.Supercluster;
  if (typeof SuperclusterCtor !== "function") {
    throw new Error("Supercluster is unavailable in worker");
  }

  const next = new SuperclusterCtor({
    ...DEFAULT_CLUSTER_OPTIONS,
    ...normalizedOptions,
    // Keep category composition available on cluster features.
    map: (props) => ({
      isorg_count: props?.isorg ? 1 : 0,
      private_count: props?.isorg ? 0 : 1,
    }),
    reduce: (acc, props) => {
      acc.isorg_count += Number(props?.isorg_count || 0);
      acc.private_count += Number(props?.private_count || 0);
    },
  });

  next.load(Array.isArray(points) ? points : []);
  return next;
}

self.onmessage = (event) => {
  const msg = event?.data || {};
  const type = String(msg?.type || "");
  const requestId = Number(msg?.requestId || 0) || 0;

  try {
    if (type === "init") {
      index = buildIndex(msg?.points, msg?.options);
      postResponse("inited", requestId, {
        pointCount: Array.isArray(msg?.points) ? msg.points.length : 0,
      });
      return;
    }

    if (!index) {
      throw new Error("Worker index is not initialized");
    }

    if (type === "query") {
      const bbox = normalizeBBox(msg?.bbox);
      const zoom = normalizeZoom(msg?.zoom);
      const clusters = index.getClusters(bbox, zoom);
      postResponse("clusters", requestId, { clusters });
      return;
    }

    if (type === "leaves") {
      const clusterId = Number(msg?.clusterId);
      if (!Number.isFinite(clusterId)) throw new Error("Invalid clusterId for leaves");
      const limit = Math.max(1, Math.min(1000, Number(msg?.limit) || 100));
      const offset = Math.max(0, Number(msg?.offset) || 0);
      const leaves = index.getLeaves(clusterId, limit, offset);
      postResponse("leaves", requestId, { leaves });
      return;
    }

    if (type === "expansionZoom") {
      const clusterId = Number(msg?.clusterId);
      if (!Number.isFinite(clusterId)) throw new Error("Invalid clusterId for expansionZoom");
      const zoom = index.getClusterExpansionZoom(clusterId);
      postResponse("expansionZoom", requestId, { zoom });
      return;
    }

    throw new Error(`Unknown worker message type: ${type}`);
  } catch (err) {
    postResponse("error", requestId, {
      message: err?.message || String(err),
    });
  }
};

self.postMessage({ type: "ready" });
