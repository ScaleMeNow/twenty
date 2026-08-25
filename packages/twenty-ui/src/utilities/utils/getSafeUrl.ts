const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

// A root-relative href has no origin of its own, so it is resolved against a base that
// cannot resolve for real, which is what tells "still relative" apart from "escaped onto
// another origin" (`//evil.com`).
const RELATIVE_URL_BASE = 'https://relative.invalid';

// Returning the parser's own serialization instead of the caller's string is what makes
// the protocol allowlist binding: the href handed to the DOM is exactly the string the
// allowlist accepted, so no later parse can disagree about where the scheme ends.
const serializeSafeUrl = (url: string, base?: string): string | undefined => {
  try {
    const parsed = new URL(url, base);

    return SAFE_URL_PROTOCOLS.includes(parsed.protocol)
      ? parsed.toString()
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
    const resolvedUrl = serializeSafeUrl(url, RELATIVE_URL_BASE);

    return resolvedUrl?.startsWith(RELATIVE_URL_BASE) === true
      ? resolvedUrl.slice(RELATIVE_URL_BASE.length)
      : undefined;
  }

  return serializeSafeUrl(url) ?? serializeSafeUrl(`https://${url}`);
};
