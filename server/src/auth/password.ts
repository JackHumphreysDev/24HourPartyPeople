import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'scrypt';
const COST = 131_072;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 256 * 1024 * 1024;

const DUMMY_PASSWORD_HASH = [
  ALGORITHM,
  COST,
  BLOCK_SIZE,
  PARALLELIZATION,
  Buffer.alloc(SALT_LENGTH).toString('base64url'),
  Buffer.alloc(KEY_LENGTH).toString('base64url'),
].join('$');

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELIZATION,
        maxmem: MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(password, salt);

  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');
  const [algorithm, cost, blockSize, parallelization, salt, expectedHash] =
    parts;

  if (
    parts.length !== 6 ||
    algorithm !== ALGORITHM ||
    Number(cost) !== COST ||
    Number(blockSize) !== BLOCK_SIZE ||
    Number(parallelization) !== PARALLELIZATION ||
    !salt ||
    !expectedHash
  ) {
    return false;
  }

  const saltBuffer = Buffer.from(salt, 'base64url');
  const expectedBuffer = Buffer.from(expectedHash, 'base64url');

  if (
    saltBuffer.length !== SALT_LENGTH ||
    expectedBuffer.length !== KEY_LENGTH
  ) {
    return false;
  }

  const actualBuffer = await deriveKey(password, saltBuffer);
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function verifyDummyPassword(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_PASSWORD_HASH);
}
