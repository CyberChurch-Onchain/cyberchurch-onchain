import { readFile } from 'node:fs/promises';
import { importPKCS8, SignJWT } from 'jose';

const privateKeyPem = await readFile(
  `${process.env.HOME}/jwt-private.pem`,
  'utf8'
);

const privateKey = await importPKCS8(
  privateKeyPem,
  'RS256'
);

const token = await new SignJWT({
  sub: 'test-user-123',
  role: 'tester'
})
  .setProtectedHeader({
    alg: 'RS256',
    typ: 'JWT'
  })
  .setIssuedAt()
  .setIssuer('https://auth.cyberchurchonchain.org/')
  .setAudience('cyberchurch-api')
  .setExpirationTime('720m')
  .sign(privateKey);

process.stdout.write(token);
