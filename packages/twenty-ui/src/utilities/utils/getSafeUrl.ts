const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

// A root-relative href has no origin of its own, so it is resolved against an origin that
// cannot exist for real. The resolved origin has to match this one exactly: a prefix test
// would accept `//relative.invalid.evil.com` as if it were still relative.
const RELATIVE_URL_ORIGIN = 'https://relative.invalid';

// Returning the parser's own serialization instead of the caller's string is what makes
// the protocol allowlist binding: the href handed to the DOM is exactly the string the
// allowlist accepted, so no later parse can disagree about where the scheme ends.
const serializeSafeUrl = (url: string): string | undefined => {
  try {
    const parsed = new URL(url);

    return SAFE_URL_PROTOCOLS.includes(parsed.protocol)
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

const serializeSafeRelativeUrl = (url: string): string | undefined => {
  try {
    const parsed = new URL(url, RELATIVE_URL_ORIGIN);

    return parsed.origin === RELATIVE_URL_ORIGIN
      ? parsed.toString().slice(RELATIVE_URL_ORIGIN.length)
      : undefined;
  } catch {
    return undefined;
  }
};

export const getSafeUrl = (
  url: string | undefined | null,
): string | undefined => {
  if (!url || url.trim().length === 0) {
    return undefined;
  }

  if (url.startsWith('/')) {
    return serializeSafeRelativeUrl(url);
  }

  return serializeSafeUrl(url) ?? serializeSafeUrl(`https://${url}`);
};
