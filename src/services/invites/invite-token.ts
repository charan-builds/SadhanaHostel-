import "server-only"

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import { getServerEnv } from "@/config/env"

const TOKEN_VERSION = "v1"

export function generateSignedInviteToken() {
  const nonce = randomBytes(32).toString("base64url")
  const signature = signNonce(nonce)

  return `${TOKEN_VERSION}.${nonce}.${signature}`
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function verifySignedInviteToken(token: string) {
  const [version, nonce, signature] = token.split(".")

  if (version !== TOKEN_VERSION || !nonce || !signature) {
    return false
  }

  const expected = signNonce(nonce)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

export function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let suffix = ""

  for (let index = 0; index < 8; index += 1) {
    suffix += alphabet[randomBytes(1)[0] % alphabet.length]
  }

  return `SBH-${suffix}`
}

function signNonce(nonce: string) {
  return createHmac("sha256", getInviteSecret()).update(nonce).digest("base64url")
}

function getInviteSecret() {
  const env = getServerEnv()

  return process.env.INVITE_TOKEN_SECRET?.trim() || env.SUPABASE_SERVICE_ROLE_KEY
}
