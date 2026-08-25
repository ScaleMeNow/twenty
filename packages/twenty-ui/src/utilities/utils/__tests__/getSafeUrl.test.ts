import { getSafeUrl } from '../getSafeUrl';

describe('getSafeUrl', () => {
  it('returns safe absolute urls as serialized by the url parser', () => {
    expect(getSafeUrl('https://twenty.com')).toBe('https://twenty.com/');
    expect(getSafeUrl('http://twenty.com')).toBe('http://twenty.com/');
    expect(getSafeUrl('https://twenty.com/pricing?plan=pro')).toBe(
      'https://twenty.com/pricing?plan=pro',
    );
    expect(getSafeUrl('mailto:hello@twenty.com')).toBe(
      'mailto:hello@twenty.com',
    );
    expect(getSafeUrl('tel:+33123456789')).toBe('tel:+33123456789');
  });

  it('keeps relative paths relative', () => {
    expect(getSafeUrl('/settings/profile')).toBe('/settings/profile');
    expect(getSafeUrl('/settings/../settings/profile')).toBe(
      '/settings/profile',
    );
  });

  it('prepends https to scheme-less urls', () => {
    expect(getSafeUrl('twenty.com')).toBe('https://twenty.com/');
  });

  it('rejects dangerous schemes', () => {
    expect(getSafeUrl('javascript:alert(1)')).toBeUndefined();
    expect(getSafeUrl('JavaScript:alert(1)')).toBeUndefined();
    expect(
      getSafeUrl('data:text/html,<script>alert(1)</script>'),
    ).toBeUndefined();
    expect(getSafeUrl('vbscript:msgbox(1)')).toBeUndefined();
  });

  it('rejects protocol-relative urls that point at another origin', () => {
    expect(getSafeUrl('//evil.com')).toBeUndefined();
  });

  it('returns undefined for empty or nullish values', () => {
    expect(getSafeUrl('')).toBeUndefined();
    expect(getSafeUrl('   ')).toBeUndefined();
    expect(getSafeUrl(undefined)).toBeUndefined();
    expect(getSafeUrl(null)).toBeUndefined();
  });
});
