import { createHash } from 'crypto';

// Postgres truncates identifiers at 63 bytes, so two long "<alias>_<column>" result
// aliases sharing a prefix would collapse onto the same key in the returned row.
// Hashing past the limit mirrors what TypeORM does through DriverUtils.buildAlias.
const POSTGRES_MAX_ALIAS_LENGTH = 63;

export const buildColumnResultAlias = (
  alias: string,
  columnName: string,
): string => {
  const resultAlias = `${alias}_${columnName}`;

  if (resultAlias.length <= POSTGRES_MAX_ALIAS_LENGTH) {
    return resultAlias;
  }

  // The digest only shortens an identifier, it guards nothing, but SHA-1 is reported as
  // weak crypto wherever it appears; a truncated SHA-256 is just as collision-safe here.
  return createHash('sha256')
    .update(resultAlias, 'utf8')
    .digest('hex')
    .slice(0, POSTGRES_MAX_ALIAS_LENGTH);
};
