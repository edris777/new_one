/* ============================================================
   API client — the fetch() counterpart of Django's URLs
   Every page reads and writes through here; nothing is rendered
   from a hard-coded copy of the data.
   ============================================================ */

const Api = (function () {
  let token = 0;
  let interceptor = null;

  function query(params) {
    const pairs = [];
    Object.keys(params || {}).forEach(key => {
      const value = params[key];
      if (value === '' || value == null) return;
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    return pairs.length ? '?' + pairs.join('&') : '';
  }

  /* the network path, always — Api.server() is how a bridge handler reaches
     the Node backend for the data that stays in SQLite */
  function raw(method, url, body) {
    const call = ++token;
    const options = {
      method: method,
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    return fetch(url, options).then(response => {
      return response.json().catch(() => ({})).then(payload => {
        payload.status = response.status;
        payload.call = call;
        if (response.status === 401 && payload.login !== false && url.indexOf('/api/who') === -1) {
          payload.login = true;
        }
        return payload;
      });
    });
  }

  /* A registered bridge answers a request locally — from Pickleball's store —
     and returns null to let the call go to the server instead. */
  function request(method, url, body) {
    if (interceptor) {
      const hit = interceptor(method, url, body);
      if (hit) return hit;
    }
    return raw(method, url, body);
  }

  return {
    get: (url, params) => request('GET', url + query(params)),
    post: (url, body) => request('POST', url, body === undefined ? {} : body),
    put: (url, body) => request('PUT', url, body || {}),
    del: url => request('DELETE', url),
    server: raw,
    use: fn => { interceptor = fn; }
  };
})();

window.Api = Api;
