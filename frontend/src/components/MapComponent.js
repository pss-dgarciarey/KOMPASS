import React, { memo, useEffect, useMemo, useState } from 'react';
import { geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup
} from 'react-simple-maps';
import world110m from '../assets/world-110m.json';
import { iso3ToCountryName, resolveIso3 } from '../lib/countryMeta';

const WORLD_GEOGRAPHIES = feature(world110m, world110m.objects.countries).features;
const DEFAULT_VIEW = { center: [0, 18], zoom: 1 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 5.6;
const ABSOLUTE_SENTIMENT_RANGE = 7.2;

const COUNTRY_CENTROIDS = new Map(
  WORLD_GEOGRAPHIES
    .map((geo) => {
      const iso3 = resolveIso3(geo.properties.name);
      return iso3 ? [iso3, geoCentroid(geo)] : null;
    })
    .filter(Boolean)
);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mixColor(start, end, ratio) {
  const safeRatio = Math.min(1, Math.max(0, ratio));
  const startValue = start.match(/[a-f0-9]{2}/gi).map((chunk) => Number.parseInt(chunk, 16));
  const endValue = end.match(/[a-f0-9]{2}/gi).map((chunk) => Number.parseInt(chunk, 16));
  const mixed = startValue.map((value, index) =>
    Math.round(value + ((endValue[index] - value) * safeRatio))
      .toString(16)
      .padStart(2, '0')
  );
  return `#${mixed.join('')}`;
}

function blendWithBase(color, ratio) {
  return mixColor('#121a24', color, clamp(ratio, 0, 1));
}

function normalizeViewport(viewport) {
  return {
    center: Array.isArray(viewport?.center) && viewport.center.length === 2
      ? [
          clamp(Number(viewport.center[0] || 0), -180, 180),
          clamp(Number(viewport.center[1] || 0), -85, 85)
        ]
      : DEFAULT_VIEW.center,
    zoom: clamp(Number(viewport?.zoom || DEFAULT_VIEW.zoom), MIN_ZOOM, MAX_ZOOM)
  };
}

function deriveViewportForRegions(regionCodes = []) {
  // Keep the auto-focus math lightweight. The map gets noticeably choppy if this starts doing anything fancy.
  const centroids = regionCodes
    .map((regionCode) => COUNTRY_CENTROIDS.get(regionCode))
    .filter((value) => Array.isArray(value) && value.length === 2);

  if (!centroids.length) {
    return DEFAULT_VIEW;
  }

  const lngValues = centroids.map((item) => item[0]);
  const latValues = centroids.map((item) => item[1]);
  const minLng = Math.min(...lngValues);
  const maxLng = Math.max(...lngValues);
  const minLat = Math.min(...latValues);
  const maxLat = Math.max(...latValues);
  const center = [
    (minLng + maxLng) / 2,
    (minLat + maxLat) / 2
  ];

  const lngSpread = Math.max(4, maxLng - minLng);
  const latSpread = Math.max(3, maxLat - minLat);
  const spread = Math.max(lngSpread / 58, latSpread / 30);
  const zoom = centroids.length === 1
    ? 3.6
    : clamp(3.9 / Math.max(0.78, spread), 1.2, 4.8);

  return normalizeViewport({ center, zoom });
}

function deriveSentimentSignal(region) {
  const tone = Number(region?.avgTone || 0);
  const goldstein = Number(region?.goldstein || 0);
  const conflictScore = Number(region?.conflictScore || 0);
  const signalShare = clamp(Number(region?.signalShare || 0), 0, 1);
  const weightedEvents = Math.max(
    0,
    Number(region?.eventCount || 0),
    Number(region?.rawEventCount || 0) * Math.max(signalShare, 0.25)
  );
  const sourceDepth = Math.max(0, Number(region?.sourceCount || 0));
  const coverageConfidence = clamp(
    0.28 +
      (Math.min(weightedEvents, 14) / 14) * 0.42 +
      (Math.min(sourceDepth, 10) / 10) * 0.18 +
      signalShare * 0.12,
    0.34,
    1
  );

  const calmBonus = clamp((5.5 - conflictScore) / 5.5, 0, 1) * 1.25;
  const conflictPenalty = clamp((conflictScore - 7.5) / 12, 0, 1) * 2.65;
  // Slightly opinionated on purpose: obvious conflict pressure should win over a mildly decent tone print.
  const composite = (tone * 0.72) + (goldstein * 0.42) + calmBonus - conflictPenalty;

  return {
    tone,
    goldstein,
    composite,
    coverageConfidence
  };
}

function toneToColor(region) {
  const { composite, coverageConfidence } = deriveSentimentSignal(region);
  const normalized = clamp(composite / ABSOLUTE_SENTIMENT_RANGE, -1, 1);
  const absolute = Math.abs(normalized);
  const eased = Math.pow(clamp((absolute - 0.06) / 0.94, 0, 1), 0.78);
  const target = normalized < 0 ? '#FF6B6B' : '#00FF9C';
  const visibility = clamp((eased * 0.85) + (coverageConfidence * 0.15), 0.12, 1);
  return blendWithBase(target, visibility * coverageConfidence);
}

function conflictToColor(score, maxScore) {
  const normalized = clamp((score || 0) / maxScore, 0, 1);
  return mixColor('#121a24', '#ff6b6b', Math.sqrt(normalized));
}

function coverageToColor(score, maxScore) {
  const normalized = clamp((score || 0) / maxScore, 0, 1);
  return mixColor('#10161d', '#00f6ff', Math.sqrt(normalized));
}

function MapComponent({
  regions,
  onSelectRegion,
  selectedRegion,
  loading,
  title,
  subtitle,
  mapLabel,
  metricMode = 'sentiment',
  heightClass = 'h-[440px] sm:h-[520px] lg:h-[620px]',
  focusRegions = [],
  autoFocusKey = 'world'
}) {
  const regionLookup = useMemo(
    () => Object.fromEntries(regions.map((item) => [item.region, item])),
    [regions]
  );
  const volatileRegions = useMemo(
    () =>
      new Set(
        [...regions]
          .sort((left, right) => {
            const rightScore = Math.max(
              Number(right?.conflictScore || 0),
              Math.abs(Number(right?.avgTone || 0)),
              Number(right?.heatScore || 0)
            );
            const leftScore = Math.max(
              Number(left?.conflictScore || 0),
              Math.abs(Number(left?.avgTone || 0)),
              Number(left?.heatScore || 0)
            );
            return rightScore - leftScore;
          })
          .slice(0, 8)
          .map((item) => item.region)
      ),
    [regions]
  );
  const maxConflictMagnitude = useMemo(
    () => Math.max(1, ...regions.map((item) => item.conflictScore || 0)),
    [regions]
  );
  const maxCoverageMagnitude = useMemo(
    () => Math.max(1, ...regions.map((item) => Math.max(item.sourceCount || 0, item.eventCount || 0))),
    [regions]
  );
  const focusSignature = useMemo(
    () => `${autoFocusKey}:${focusRegions.join(',')}`,
    [autoFocusKey, focusRegions]
  );
  const focusViewport = useMemo(
    () => deriveViewportForRegions(focusRegions),
    [focusSignature]
  );
  const [viewport, setViewport] = useState(focusViewport);

  useEffect(() => {
    // Reset cleanly when the active theater/map mode changes, otherwise users end up lost in the wrong ocean.
    setViewport(focusViewport);
  }, [focusSignature, focusViewport]);

  function updateViewport(nextViewport) {
    setViewport(normalizeViewport(nextViewport));
  }

  function handleZoom(delta) {
    updateViewport({
      center: viewport.center,
      zoom: viewport.zoom + delta
    });
  }

  return (
    <div className="panel grain-mask min-h-[460px] sm:min-h-[560px] lg:min-h-[620px] rounded-[28px] p-4 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-kicker text-[11px] text-cyan-200/70">{mapLabel || 'Sentiment atlas'}</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title || 'World emotional temperature'}</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            {subtitle ||
              'Countries are colored on an absolute calm-to-stress scale using tone, Goldstein, and conflict pressure, so lower-conflict countries can stay visibly green while active theaters stay red.'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
          <div className="text-kicker text-[10px] text-cyan-200/70">Legend</div>
          <div
            className={`mt-2 h-2 w-28 rounded-full ${
              metricMode === 'conflict'
                ? 'bg-gradient-to-r from-[#121a24] via-[#ffb86b] to-[#ff6b6b]'
                : metricMode === 'coverage'
                  ? 'bg-gradient-to-r from-[#10161d] via-[#00f6ff] to-[#00ff9c]'
                  : 'bg-gradient-to-r from-[#ff6b6b] via-[#121a24] to-[#00ff9c]'
            }`}
          />
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{metricMode === 'conflict' ? 'Quiet' : metricMode === 'coverage' ? 'Thin' : 'Tense'}</span>
            <span>{metricMode === 'conflict' ? 'Conflict' : metricMode === 'coverage' ? 'Dense' : 'Calm'}</span>
          </div>
        </div>
      </div>

      <div className="map-stage relative overflow-hidden rounded-[24px] border border-white/8 bg-black/25">
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleZoom(0.4)}
            className="focus-ring rounded-full border border-white/10 bg-black/60 px-3 py-2 text-sm font-medium text-white transition hover:bg-black/75"
            aria-label="Zoom in on the map"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-0.4)}
            className="focus-ring rounded-full border border-white/10 bg-black/60 px-3 py-2 text-sm font-medium text-white transition hover:bg-black/75"
            aria-label="Zoom out on the map"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => updateViewport(focusViewport)}
            className="focus-ring rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-400/15"
          >
            Reset
          </button>
        </div>

        <ComposableMap
          projectionConfig={{ scale: 168 }}
          className={`${heightClass} w-full`}
          aria-label="World map sentiment dashboard"
        >
          <ZoomableGroup
            center={viewport.center}
            zoom={viewport.zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onMoveEnd={(position) => {
              updateViewport({
                center: position.coordinates,
                zoom: position.zoom
              });
            }}
          >
            <Geographies geography={WORLD_GEOGRAPHIES}>
              {({ geographies }) => (
                <>
                  {geographies.map((geo) => {
                    const iso3 = resolveIso3(geo.properties.name);
                    const region = iso3 ? regionLookup[iso3] : null;
                    const isSelected = selectedRegion === iso3;
                    const fill = region
                      ? metricMode === 'conflict'
                        ? conflictToColor(region.conflictScore, maxConflictMagnitude)
                        : metricMode === 'coverage'
                          ? coverageToColor(
                              Math.max(region.sourceCount || 0, region.eventCount || 0),
                              maxCoverageMagnitude
                            )
                          : toneToColor(region)
                      : '#10161d';
                    const countryName = iso3 ? iso3ToCountryName(iso3) : geo.properties.name;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        tabIndex={iso3 ? 0 : -1}
                        role={iso3 ? 'button' : 'img'}
                        aria-label={`${countryName}. ${
                          region
                            ? `AvgTone ${region.avgTone.toFixed(1)}, Goldstein ${region.goldstein.toFixed(1)}`
                            : 'No recent data'
                        }`}
                        onClick={() => {
                          if (iso3) {
                            onSelectRegion(iso3);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (iso3 && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            onSelectRegion(iso3);
                          }
                        }}
                        style={{
                          default: {
                            fill,
                            stroke: isSelected ? '#00F6FF' : 'rgba(255,255,255,0.12)',
                            strokeWidth: isSelected ? 1.2 : 0.55,
                            outline: 'none'
                          },
                          hover: {
                            fill: region
                              ? metricMode === 'conflict'
                                ? conflictToColor((region.conflictScore || 0) * 1.08, maxConflictMagnitude)
                                : metricMode === 'coverage'
                                  ? coverageToColor(
                                      Math.max((region.sourceCount || 0) * 1.08, (region.eventCount || 0) * 1.08),
                                      maxCoverageMagnitude
                                    )
                                  : toneToColor({
                                      ...region,
                                      avgTone: Number(region.avgTone || 0) * 1.04,
                                      goldstein: Number(region.goldstein || 0) * 1.02
                                    })
                              : '#1f2a35',
                            stroke: '#00F6FF',
                            strokeWidth: 1.15,
                            outline: 'none'
                          },
                          pressed: {
                            fill,
                            outline: 'none'
                          }
                        }}
                        className="focus-ring transition-all duration-200"
                      >
                        <title>{countryName}</title>
                      </Geography>
                    );
                  })}

                  {geographies
                    .filter((geo) => {
                      const iso3 = resolveIso3(geo.properties.name);
                      return iso3 && volatileRegions.has(iso3);
                    })
                    .map((geo) => {
                      const iso3 = resolveIso3(geo.properties.name);
                      const centroid = geoCentroid(geo);
                      return (
                        <Marker key={`${geo.rsmKey}-marker`} coordinates={centroid}>
                          <circle className="pulse-hotspot" r={5} fill="rgba(0,246,255,0.45)" />
                          <circle r={1.6} fill="#00F6FF" />
                          <title>{iso3 ? iso3ToCountryName(iso3) : geo.properties.name}</title>
                        </Marker>
                      );
                    })}
                </>
              )}
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        <div className="absolute bottom-3 left-3 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-xs text-slate-300">
          {loading ? 'Syncing geopulse layers...' : 'Hover for country name. Click to inspect the full signal profile.'}
        </div>
      </div>
    </div>
  );
}

export default memo(MapComponent);
