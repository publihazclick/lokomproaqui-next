const https = require('https');
const fs = require('fs');

const SUPABASE_URL = process.env.SB_URL;
const ANON_KEY = process.env.SB_ANON;
const roleName = process.argv[2] || 'vendedor';
const outFile = process.argv[3] || 'qa-storage-state.json';
const TS = Date.now();
const email = `qa.responsive.${roleName}.${TS}@lokomproaqui-test.com`;

const body = JSON.stringify({
  email,
  password: 'TestQA12345!',
  data: { full_name: `QA ${roleName}`, phone: `301${String(TS).slice(-7)}`, role_name: roleName },
});

const url = new URL(SUPABASE_URL + '/auth/v1/signup');
const req = https.request(url, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
  let data = '';
  res.on('data', (c) => (data += c));
  res.on('end', () => {
    const session = JSON.parse(data);
    if (!session.user) { console.log('ERROR:', data); return; }
    const storageState = {
      origins: [
        {
          origin: 'https://lokomproaqui.com',
          localStorage: [
            { name: `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`, value: JSON.stringify(session) },
          ],
        },
      ],
    };
    fs.writeFileSync(outFile, JSON.stringify(storageState, null, 2));
    console.log('email:', email);
    console.log('user id:', session.user.id);
    console.log('archivo:', outFile);
  });
});
req.write(body);
req.end();
