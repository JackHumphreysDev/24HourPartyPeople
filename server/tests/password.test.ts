import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password hashing', () => {
  it('uses a unique salt and verifies only the matching password', async () => {
    const password = 'correct horse battery staple';
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toBe(secondHash);
    await expect(verifyPassword(password, firstHash)).resolves.toBe(true);
    await expect(verifyPassword('incorrect password', firstHash)).resolves.toBe(
      false,
    );
  });

  it('rejects malformed and unsupported stored hashes', async () => {
    await expect(verifyPassword('a password', 'not-a-hash')).resolves.toBe(
      false,
    );
    await expect(
      verifyPassword(
        'a password',
        'scrypt$131072$8$1$invalid$invalid$unexpected',
      ),
    ).resolves.toBe(false);
  });
});
