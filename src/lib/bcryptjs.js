const DEFAULT_ITERATIONS = 1000
const BLOCK_SIZE = 32
const PREFIX = 'pbkdf2'

const getCrypto = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto
  }
  throw new Error('Crypto API not available in this environment')
}

const toBase64 = (buffer) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64')
  }
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const fromBase64 = (value) => {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

const prepareKeyMaterial = async (password) => {
  const crypto = getCrypto()
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
}

export async function hash(password, saltRounds = 10) {
  const crypto = getCrypto()
  const iterations = Math.max(1, saltRounds) * DEFAULT_ITERATIONS
  const salt = new Uint8Array(BLOCK_SIZE)
  crypto.getRandomValues(salt)

  const keyMaterial = await prepareKeyMaterial(password)
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    BLOCK_SIZE * 8
  )

  const saltB64 = toBase64(salt)
  const hashB64 = toBase64(derivedBits)
  return `${PREFIX}$${iterations}$${saltB64}$${hashB64}`
}

export async function compare(password, hashedValue) {
  if (typeof hashedValue !== 'string') return false
  const parts = hashedValue.split('$')
  if (parts.length !== 4 || parts[0] !== PREFIX) return false

  const iterations = parseInt(parts[1], 10)
  if (Number.isNaN(iterations) || iterations <= 0) return false

  const saltBytes = fromBase64(parts[2])
  const expectedHash = parts[3]
  const crypto = getCrypto()
  const keyMaterial = await prepareKeyMaterial(password)
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations,
    },
    keyMaterial,
    BLOCK_SIZE * 8
  )
  const derivedHash = toBase64(derivedBits)
  return timingSafeEqual(derivedHash, expectedHash)
}

export default {
  hash,
  compare,
}
