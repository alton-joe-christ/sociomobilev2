import { SignJWT, jwtVerify } from 'jose';

const getSecret = () => new TextEncoder().encode(process.env.WALLET_JWT_SECRET || 'socio-secure-wallet-secret-2026-fallback');

export async function generateSecurePassPayload(payload: {
  attendeeId: string;
  eventId: string;
  registrationId: string;
  participantName: string;
}) {
  const jwt = await new SignJWT({
    attendeeId: payload.attendeeId,
    eventId: payload.eventId,
    registrationId: payload.registrationId,
    credentialVersion: "1.0"
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(getSecret());
    
  return jwt;
}

export async function verifySecurePassPayload(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch (err) {
    return null;
  }
}
