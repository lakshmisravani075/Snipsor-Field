const WS = require('ws');
(async () => {
  const targets = await (await fetch('http://127.0.0.1:8082/json/list')).json();
  const ws = new WS(targets[0].webSocketDebuggerUrl, {origin: 'http://localhost:8082'});
  const timer = setTimeout(() => ws.close(), 15000);
  ws.on('open', () => ws.send(JSON.stringify({id: 1, method: 'Runtime.enable'})));
  ws.on('message', async raw => {
    const msg = JSON.parse(raw);
    if (msg.id === 1) ws.send(JSON.stringify({id: 2, method: 'Runtime.evaluate', params: {expression: 'globalThis.__SNIPSOR_FIELD_AUTH_TOKEN__', returnByValue: true}}));
    if (msg.id !== 2) return;
    clearTimeout(timer); ws.close();
    const token = msg.result?.result?.value;
    if (typeof token !== 'string') return console.log('No active session');
    try {
      for (const suffix of ['', '/acquisition/timeline']) {
        const response = await fetch('https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/leads/b1aace98-f693-4f97-af94-aeebd22cf978' + suffix, {headers: {Authorization: 'Bearer ' + token, 'Cache-Control': 'no-cache'}});
        const body = await response.json();
        const fields = [];
        const walk = (obj, path, depth) => {
          if (!obj || typeof obj !== 'object' || depth > 7) return;
          for (const [key, value] of Object.entries(obj)) {
            if (value && typeof value === 'object') walk(value, path + '.' + key, depth + 1);
            else if (/date|time|status|success/i.test(key)) fields.push({path: path + '.' + key, value});
          }
        };
        walk(body, 'body', 0);
        console.log(JSON.stringify({endpoint: suffix || 'details', httpStatus: response.status, fields}));
      }
    } catch (error) { console.error(error.message); }
  });
})();
