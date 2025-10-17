import { supabase } from './supabaseClient'

const LOCAL_HASH_PREFIX = 'pbkdf2-sha256'
const LOCAL_HASH_ITERATIONS = 310_000
const LOCAL_HASH_KEY_LENGTH = 32
const LOCAL_SALT_LENGTH = 16
const textEncoder = new TextEncoder()

const getCrypto = () => {
  const crypto = globalThis.crypto ?? null
  if (!crypto || typeof crypto.getRandomValues !== 'function' || !crypto.subtle) {
    throw new Error('Criptografía web no disponible en este entorno.')
  }
  return crypto
}

const bufferToBase64 = (buffer) => {
  if (typeof globalThis !== 'undefined' && typeof globalThis.Buffer === 'function') {
    return globalThis.Buffer.from(buffer).toString('base64')
  }
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return globalThis.btoa(binary)
}

const deriveKey = async (password, salt, iterations) => {
  const crypto = getCrypto()
  const baseKey = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    baseKey,
    LOCAL_HASH_KEY_LENGTH * 8,
  )
  return new Uint8Array(bits)
}

const hashPasswordLocally = async (password) => {
  const crypto = getCrypto()
  const salt = new Uint8Array(LOCAL_SALT_LENGTH)
  crypto.getRandomValues(salt)
  const derived = await deriveKey(password, salt, LOCAL_HASH_ITERATIONS)
  return `${LOCAL_HASH_PREFIX}$${LOCAL_HASH_ITERATIONS}$${bufferToBase64(salt)}$${bufferToBase64(derived)}`
}

export const hashPasswordWithDatabase = async (password) => {
  const plain = password ?? ''
  if (!plain) throw new Error('La contraseña no puede estar vacía.')

  let hashed = null

  try {
    const saltResponse = await supabase.rpc('gen_salt', { type: 'bf' })
    if (saltResponse?.error) {
      console.warn('[passwords] Supabase no pudo generar un salt bcrypt, se usará un hash local:', saltResponse.error)
    } else if (saltResponse?.data) {
      const { data: remoteHash, error: hashError } = await supabase.rpc('crypt', {
        password: plain,
        salt: saltResponse.data,
      })
      if (hashError) {
        console.warn('[passwords] Supabase no pudo hashear la contraseña, se usará un hash local:', hashError)
      } else if (remoteHash) {
        hashed = remoteHash
      }
    }
  } catch (err) {
    console.warn('[passwords] Supabase no disponible para generar hash bcrypt, se usará un hash local:', err)
  }

  if (hashed) return hashed

  try {
    return await hashPasswordLocally(plain)
  } catch (err) {
    console.error('[passwords] Error generando hash local de contraseña:', err)
    throw new Error('No se pudo proteger la contraseña.')
  }
}
