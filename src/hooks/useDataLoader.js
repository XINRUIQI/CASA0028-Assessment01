/**
 * useDataLoader
 * Loads the three static data files produced by the Python pipeline
 * (ass01/scripts/build_dataset.py):
 *
 *   areas.geojson  – 33 London Borough boundaries (GLA, simplified for web)
 *   features.json  – Month × Borough panel: theft_count, exposure,
 *                    risk_ratio, risk_index, alert_spike, alert_trend3, …
 *   meta.json      – Available months, area index, field descriptions
 *
 * Data sources used by the pipeline:
 *   - UK Police Open Data API  (bicycle theft incidents per borough/month)
 *   - OpenStreetMap Overpass API (cycle parking nodes/ways as exposure proxy)
 *   - GLA London Borough Boundaries GeoPackage
 *
 * ⚠ Limitation: The UK Police API publishes data with a ~2-3 month lag.
 *   Months with no published data will have theft_count = 0, which causes
 *   risk metrics to collapse to zero.  The current public/data/ snapshot
 *   uses realistically-distributed synthetic figures for demonstration
 *   purposes; replace with a fresh pipeline run once real data is available.
 *
 * All three files are fetched in parallel and cached for the app lifetime.
 * Returns { areas, features, meta, loading, error }.
 */

import { useState, useEffect } from 'react'

const BASE = import.meta.env.BASE_URL   // '/' in dev, '/repo-name/' in prod

async function fetchJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`Failed to load ${path} (HTTP ${res.status})`)
  return res.json()
}

export function useDataLoader() {
  const [areas,    setAreas]    = useState(null)
  const [features, setFeatures] = useState(null)
  const [meta,     setMeta]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetchJson('data/areas.geojson'),
      fetchJson('data/features.json'),
      fetchJson('data/meta.json'),
    ])
      .then(([areasData, featuresData, metaData]) => {
        if (cancelled) return
        setAreas(areasData)
        setFeatures(featuresData)
        setMeta(metaData)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { areas, features, meta, loading, error }
}
