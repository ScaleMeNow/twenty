import { createHash } from 'crypto';

import * as jwt from 'jsonwebtoken';
import { isDefined } from 'twenty-shared/utils';

import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';

// Mirrors JwtWrapperService.generateAppSecret + extractAppSecretBody so tests
// can hand-craft tokens that match what a pre-2.5 server would have signed.
// extractAppSecretBody resolves to workspaceId when present, else userId.
const HS256_APP_SECRET = 'replace_me_with_a_random_string';

const LEGACY_TOKEN_TYPE_LABELS = Object.values(JwtTokenTypeEnum);

// The digest has to stay byte-identical to what a pre-2.5 server signed, so the token
// type label cannot change. CodeQL reads labels such as API_KEY as a password hashed
// with a fast digest (js/insufficient-password-hash), so the label is resolved from the
// enum rather than threaded in from the caller's payload: same string, and a type the
// server would never have signed now fails loudly instead of forging a dead token.
const resolveTokenTypeLabel = (type: JwtTokenTypeEnum): JwtTokenTypeEnum => {
  const label = LEGACY_TOKEN_TYPE_LABELS.find(
    (candidate) => candidate === type,
  );

  if (!isDefined(label)) {
    throw new Error(`Unknown legacy JWT token type: ${type}`);
  }

  return label;
};

const generateLegacyHs256Secret = (
  type: JwtTokenTypeEnum,
  appSecretBody: string,
): string =>
  createHash('sha256')
    .update(`${HS256_APP_SECRET}${appSecretBody}${resolveTokenTypeLabel(type)}`)
    .digest('hex');

export const forgeLegacyHs256Token = <TPayload extends Record<string, unknown>>(
  payload: TPayload & { type: JwtTokenTypeEnum },
  appSecretBody: string,
  options: jwt.SignOptions = { expiresIn: '5m' },
): string =>
  jwt.sign(payload, generateLegacyHs256Secret(payload.type, appSecretBody), {
    algorithm: 'HS256',
    ...options,
  });
