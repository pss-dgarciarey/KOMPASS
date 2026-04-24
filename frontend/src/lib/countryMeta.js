import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale);

const COUNTRY_NAME_ALIASES = {
  Bolivia: 'Bolivia, Plurinational State of',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  Brunei: 'Brunei Darussalam',
  'Central African Rep.': 'Central African Republic',
  Congo: 'Congo',
  'Dem. Rep. Congo': 'Congo, The Democratic Republic of the',
  'Dominican Rep.': 'Dominican Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  Iran: 'Iran, Islamic Republic of',
  IvoryCoast: "Cote d'Ivoire",
  Laos: "Lao People's Democratic Republic",
  Moldova: 'Moldova, Republic of',
  Russia: 'Russian Federation',
  'S. Sudan': 'South Sudan',
  'Solomon Is.': 'Solomon Islands',
  'South Korea': 'Korea, Republic of',
  Syria: 'Syrian Arab Republic',
  Tanzania: 'Tanzania, United Republic of',
  'United States of America': 'United States',
  Venezuela: 'Venezuela, Bolivarian Republic of',
  Vietnam: 'Viet Nam'
};

const MANUAL_ISO3_BY_NAME = {
  Bolivia: 'BOL',
  'Dem. Rep. Congo': 'COD',
  'Falkland Is.': 'FLK',
  Iran: 'IRN',
  Macedonia: 'MKD',
  'N. Cyprus': 'CYP',
  Somaliland: 'SOM',
  Tanzania: 'TZA',
  Venezuela: 'VEN',
  Vietnam: 'VNM',
  'W. Sahara': 'ESH'
};

export function resolveIso3(name) {
  if (!name) {
    return null;
  }

  const aliased = COUNTRY_NAME_ALIASES[name] || name;
  const iso3 = countries.getAlpha3Code(aliased, 'en');
  return iso3 || MANUAL_ISO3_BY_NAME[name] || null;
}

export function iso3ToCountryName(iso3) {
  if (!iso3) {
    return 'Unknown region';
  }

  const alpha2 = countries.alpha3ToAlpha2(iso3);
  return countries.getName(alpha2, 'en') || iso3;
}

export function iso3ToAlpha2(iso3) {
  if (!iso3) {
    return '';
  }

  return countries.alpha3ToAlpha2(iso3) || '';
}

export function iso3ToFlag(iso3) {
  return iso3ToAlpha2(iso3) || 'GL';
}
