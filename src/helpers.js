const _nfCache = new Map();

/**
 * Format numbers with Intl.NumberFormat, with sensible defaults:
 * - integers: 0 decimals
 * - non-integers: up to maxDecimals (default 2)
 * - no trailing zeros (minDecimals default 0)
 */
export function formatNumber(
  value,
  {
    locale = "nl-NL",
    maxDecimals = 2,
    minDecimals = 0,
    useGrouping = true,
    // Optional: force a fixed number of decimals (like toFixed but localized)
    fixedDecimals = null, // e.g. 2 -> always 2 decimals
  } = {}
) {
  if (value == null || Number.isNaN(value)) return "";

  const isInt = Number.isInteger(value);

  const effectiveMin =
    fixedDecimals != null ? fixedDecimals : minDecimals;

  const effectiveMax =
    fixedDecimals != null ? fixedDecimals : (isInt ? 0 : maxDecimals);

  const key = `${locale}|${effectiveMin}|${effectiveMax}|${useGrouping}`;
  let fmt = _nfCache.get(key);

  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      minimumFractionDigits: effectiveMin,
      maximumFractionDigits: effectiveMax,
      useGrouping,
    });
    _nfCache.set(key, fmt);
  }

  return fmt.format(value);
}
