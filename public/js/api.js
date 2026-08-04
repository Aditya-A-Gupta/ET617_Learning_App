// Thin fetch wrapper for the LearnStream API.
const Api = {
  async _req(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get(url) { return this._req('GET', url); },
  post(url, body) { return this._req('POST', url, body || {}); },
};
