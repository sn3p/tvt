export class HttpError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export async function fetchJson(url, { signal } = {}) {
  let res;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    // Often CORS/network problems show up as TypeError: Failed to fetch
    const e = new HttpError(`Network/CORS error for ${url}`, { status: 0, url });
    e.cause = err;
    throw e;
  }

  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      // ignore
    }
    throw new HttpError(`HTTP ${res.status} for ${url}`, { status: res.status, url, body: bodyText });
  }
  return await res.json();
}

