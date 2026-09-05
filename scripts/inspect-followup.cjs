const WebSocket = require('ws');
(async () => {
  const targets = await (await fetch('http://localhost:8082/json/list')).json();
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  const timeout = setTimeout(() => { ws.close(); process.exit(1); }, 25000);
  ws.on('open', () => ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {
    awaitPromise: true, returnByValue: true,
    expression: `(async () => {
      const token = globalThis.__SNIPSOR_FIELD_AUTH_TOKEN__;
      if (!token) return {error: 'No active login token'};
      const results = [];
      for (const suffix of ['', '/acquisition/timeline']) {
        const response = await fetch('https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/leads/b1aace98-f693-4f97-af94-aeebd22cf978' + suffix, {headers: {Authorization: 'Bearer ' + token, 'Cache-Control': 'no-cache'}});
        const body = await response.json();
        const fields = [];
        const walk = (value, path, depth) => {
          if (!value || typeof value !== 'object' || depth > 7) return;
          for (const [key, v] of Object.entries(value)) {
            const p = path + '.' + key;
            if (v && typeof v === 'object') walk(v, p, depth + 1);
            else if (/date|time|status|title|message|success|event|action/i.test(key) && !/token/i.test(key)) fields.push({path:p, value:v});
          }
        };
        walk(body, 'body', 0);
        results.push({endpoint:suffix || 'details', httpStatus:response.status, fields});
      }
      return results;
    })()`
  }})));
  ws.on('message', raw => {
    const msg = JSON.parse(raw);
    if (msg.id === 1) {
      console.log(JSON.stringify(msg.result || msg.error, null, 2));
      clearTimeout(timeout); ws.close();
    }
  });
})();
