import React, { useEffect, useMemo, useState } from 'react';
import { iso3ToAlpha2, iso3ToCountryName } from '../lib/countryMeta';

function buildFlagUrl(alpha2) {
  return `https://flagcdn.com/${alpha2.toLowerCase()}.svg`;
}

export default function CountryFlag({
  iso3,
  className = '',
  imageClassName = '',
  label,
  size = 'md',
  rounded = true
}) {
  const alpha2 = useMemo(() => iso3ToAlpha2(iso3), [iso3]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [alpha2]);

  const sizeClass =
    size === 'lg'
      ? 'h-12 w-16'
      : size === 'sm'
        ? 'h-4 w-6'
        : 'h-5 w-7';
  const borderRadiusClass = rounded ? 'rounded-[6px]' : '';
  const accessibleLabel = label || (iso3 ? `${iso3ToCountryName(iso3)} flag` : 'Country flag');

  if (!alpha2 || failed) {
    return (
      <span
        aria-label={accessibleLabel}
        title={accessibleLabel}
        className={[
          'inline-flex items-center justify-center border border-white/10 bg-white/5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300',
          sizeClass,
          borderRadiusClass,
          className
        ].filter(Boolean).join(' ')}
      >
        {alpha2 || 'GL'}
      </span>
    );
  }

  return (
    <img
      src={buildFlagUrl(alpha2)}
      alt={accessibleLabel}
      title={accessibleLabel}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={[
        'inline-block border border-white/10 bg-white/5 object-cover shadow-[0_8px_24px_rgba(0,0,0,0.2)]',
        sizeClass,
        borderRadiusClass,
        className,
        imageClassName
      ].filter(Boolean).join(' ')}
    />
  );
}
