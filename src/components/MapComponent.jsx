import React, { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, LayersControl, Marker, CircleMarker, useMap, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import axios from 'axios'
import { supabase } from '../supabaseClient'
import Legend from './Legend'
import ReportForm from './ReportForm'

// Default center (Maseno Main Campus)
const DEFAULT_CENTER = [-0.0145, 34.6067]

function FitBounds({ geojson }){
  const map = useMap()
  useEffect(()=>{
    if(!geojson) return
    try{ const layer = L.geoJSON(geojson); map.fitBounds(layer.getBounds(), { maxZoom:17 }) }catch(e){}
  },[geojson])
  return null
}

function SetViewOnLoad({ center, zoom, mapRef }){
  useEffect(()=>{
    if(mapRef && mapRef.current){
      try{ mapRef.current.setView(center, zoom) }catch(e){}
    }
  },[mapRef])
  return null
}

export default function MapComponent(){
  // Fix Leaflet default icon URLs (avoid 404s on gh-pages)
  try{
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
    })
  }catch(e){}
  const [polygons, setPolygons] = useState(null)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const [lines, setLines] = useState(null)
  const [allPolygons, setAllPolygons] = useState(null)
  const [allLines, setAllLines] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [heatData, setHeatData] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [routeGeoJSON, setRouteGeoJSON] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null)
  const [selecting, setSelecting] = useState(null) // 'origin'|'dest'|null
  const [routePoints, setRoutePoints] = useState({ origin: null, dest: null })
  const mapRef = useRef()

  // Post user location periodically to backend to populate heatmap
  useEffect(()=>{
    let id
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        // store location in Supabase if configured
        if(supabase){
          ;(async ()=>{
            try{ await supabase.from('user_locations').insert([{ lat: loc.lat, lng: loc.lng }]) }catch(e){ console.warn('Failed to insert user location', e) }
          })()
        }
      })
      // optional: watchPosition could be used
    }
    return ()=>{ if(id) navigator.geolocation.clearWatch(id) }
  },[])

  useEffect(()=>{
    // Load polygons and lines either directly from Supabase (if configured)
    // or fall back to the backend API
    async function loadFromSupabase(){
      setLoading(true)
      setErrorMsg(null)
      try{
        // Prefer a server-side view that returns GeoJSON (create this view in Supabase SQL):
        // msu_polygon_facilities_geo with a column `geojson` (JSON)
        const { data: p, error: perr } = await supabase.from('msu_polygon_facilities_geo').select('*')
        if(perr) throw perr
        if(p){
          const features = { type: 'FeatureCollection', features: p.map(item => ({
            type:'Feature',
            geometry: item.geojson || ((item.geom && typeof item.geom === 'object')? item.geom : (item.geom? JSON.parse(item.geom): null)),
            properties: { ...item }
          })) }
          setAllPolygons(features)
          setPolygons(features)
        }
      }catch(err){
        console.warn('Supabase polygons view failed, trying table fallback', err.message)
        try{
          const { data: p2, error: perr2 } = await supabase.from('MSU_Polygon_Facilities').select('*')
          if(perr2) throw perr2
          if(p2){
            const features = { type: 'FeatureCollection', features: p2.map(item => ({
              type:'Feature',
              geometry: (item.geom && typeof item.geom === 'object')? item.geom : (item.geom? JSON.parse(item.geom): null),
              properties: { ...item }
            })) }
            setAllPolygons(features)
            setPolygons(features)
          }
        }catch(err2){ console.warn('Supabase polygons failed, falling back', err2.message); setErrorMsg('Failed to load polygon data') }
      }

      try{
        const { data: l, error: lerr } = await supabase.from('msu_polyline_facilities_geo').select('*')
        if(lerr) throw lerr
        if(l){
          const features = { type: 'FeatureCollection', features: l.map(item => ({
            type:'Feature',
            geometry: item.geojson || ((item.geom && typeof item.geom === 'object')? item.geom : (item.geom? JSON.parse(item.geom): null)),
            properties: { ...item }
          })) }
          setAllLines(features)
          setLines(features)
        }
      }catch(err){
        console.warn('Supabase lines view failed, trying table fallback', err.message)
        try{
          const { data: l2, error: lerr2 } = await supabase.from('MSU_Polyline_Facilities').select('*')
          if(lerr2) throw lerr2
          if(l2){
            const features = { type: 'FeatureCollection', features: l2.map(item => ({
              type:'Feature',
              geometry: (item.geom && typeof item.geom === 'object')? item.geom : (item.geom? JSON.parse(item.geom): null),
              properties: { ...item }
            })) }
            setAllLines(features)
            setLines(features)
          }
        }catch(err2){ console.warn('Supabase lines failed, falling back', err2.message); setErrorMsg(prev=>prev? prev + '; lines failed':'Failed to load line data') }
      }

      try{
        const { data: u, error: uerr } = await supabase.from('user_locations').select('*')
        if(uerr) throw uerr
        if(u){
          setHeatData(u.map(r=> ({ id: r.id, lat: r.geom?.y || r.lat, lng: r.geom?.x || r.lng })))
        }
      }catch(err){ console.warn('Supabase locations failed, falling back', err.message); setErrorMsg(prev=>prev? prev + '; locations failed':'Failed to load locations') }

      setLoading(false)
    }

    // Only use Supabase in this build; avoid hitting localhost on gh-pages.
    if(supabase){
      loadFromSupabase().then(()=>{/*done*/}).catch((e)=>{ console.error('Supabase load failed', e); setErrorMsg('Failed to load Supabase data') })
    } else {
      setLoading(false)
      setErrorMsg('Supabase client not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or provide global window.SUPABASE_URL/ANON_KEY')
    }
  },[])

  // Filter features by search term (case-insensitive) across string properties
  useEffect(()=>{
    if(!searchTerm){ setPolygons(allPolygons); setLines(allLines); return }
    const q = searchTerm.toLowerCase()
    function matchFeature(feat){
      if(!feat || !feat.properties) return false
      for(const k of Object.keys(feat.properties)){
        const v = feat.properties[k]
        if(typeof v === 'string' && v.toLowerCase().includes(q)) return true
        if(typeof v === 'number' && String(v).includes(q)) return true
      }
      return false
    }
    if(allPolygons){
      const f = { type:'FeatureCollection', features: allPolygons.features.filter(matchFeature) }
      setPolygons(f)
    }
    if(allLines){
      const f = { type:'FeatureCollection', features: allLines.features.filter(matchFeature) }
      setLines(f)
    }
  },[searchTerm, allPolygons, allLines])

  // Routing: click to set origin/destination
  function RoutingClicker() {
    useMapEvents({
      click(e) {
        if (selecting === 'origin') {
          setRoutePoints(p => ({ ...p, origin: e.latlng }))
          setSelecting('dest')
        } else if (selecting === 'dest') {
          setRoutePoints(p => ({ ...p, dest: e.latlng }))
          setSelecting(null)
        }
      }
    })
    return null
  }

  // When both points set, fetch route
  useEffect(() => {
    async function fetchRoute() {
      if (routePoints.origin && routePoints.dest) {
        setRouteGeoJSON(null)
        setRouteInfo(null)
        try {
          // Use OSRM public server for routing (client-side) to avoid backend dependency
          const oStart = `${routePoints.origin.lng},${routePoints.origin.lat}`
          const oEnd = `${routePoints.dest.lng},${routePoints.dest.lat}`
          const url = `https://router.project-osrm.org/route/v1/foot/${oStart};${oEnd}?overview=full&geometries=geojson`
          const r = await axios.get(url)
          if (r.data && r.data.routes && r.data.routes[0]) {
            const route = r.data.routes[0]
            setRouteGeoJSON(route.geometry)
            setRouteInfo({ duration: route.duration, distance: route.distance })
          }
        } catch (e) { console.error(e) }
      }
    }
    fetchRoute()
  }, [routePoints])

  function onEachPolygon(feature, layer){
    const props = feature.properties || {}
    const html = `<div><strong>${props.name||props.title||'Feature'}</strong><br/>Category: ${props.category||''}<br/><small>Click for walking time from you</small></div>`
    layer.bindPopup(html)
    layer.on('click', async ()=>{
      try{
        layer.setStyle({ weight:4, color:'#ff7800' })
        // If we have user location, compute walking route via OSRM public API
        if(userLocation){
          // compute centroid of feature
          const tmp = L.geoJSON(feature)
          const center = tmp.getBounds().getCenter()
          try{
            const oStart = `${userLocation.lng},${userLocation.lat}`
            const oEnd = `${center.lng},${center.lat}`
            const url = `https://router.project-osrm.org/route/v1/foot/${oStart};${oEnd}?overview=full&geometries=geojson`
            const r = await axios.get(url)
            if(r.data && r.data.routes && r.data.routes[0]){
              const route = r.data.routes[0]
              setRouteGeoJSON(route.geometry)
              setRouteInfo({ duration: route.duration, distance: route.distance })
              // open popup with travel time
              layer.bindPopup(`<div><strong>${props.name||'Feature'}</strong><br/>Walking time: ${Math.round(route.duration/60)} min<br/>Distance: ${Math.round(route.distance)} m</div>`).openPopup()
            }
          }catch(e){ console.error('Routing failed', e) }
        } else {
          layer.bindPopup(`<div><strong>${props.name||'Feature'}</strong><br/>Enable location to see walking time</div>`).openPopup()
        }
      }catch(e){ console.error(e) }
    })
  }

  const categoryStyle = (feature)=>{
    const cat = feature.properties.category || feature.properties.type || 'other'
    // simple color mapping
    const colors = { Academic:'#8dd3c7', Hostel:'#fb8072', Service:'#bebada', other:'#fdb462' }
    return { color: '#333', weight:1, fillColor: colors[cat] || '#b3de69', fillOpacity: 0.6 }
  }

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={16} style={{height:'100%', width:'100%'}} whenCreated={m=>mapRef.current=m}>
      {/* Ensure the map is centered reliably on create */}
      <SetViewOnLoad center={DEFAULT_CENTER} zoom={16} mapRef={mapRef} />
      <RoutingClicker />
            {/* Routing UI */}
            <div style={{position:'absolute', left:10, top:60, zIndex:1000, background:'#fff', padding:8, borderRadius:6, boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}>
              <div style={{fontWeight:700}}>Route Tool</div>
              <button onClick={()=>{setSelecting('origin');setRoutePoints({origin:null,dest:null});setRouteGeoJSON(null);setRouteInfo(null)}} disabled={selecting==='origin'}>Start Routing</button>
              <div style={{fontSize:12,marginTop:4}}>
                {selecting==='origin' && 'Click map for origin'}
                {selecting==='dest' && 'Click map for destination'}
                {routePoints.origin && <div>Origin: {routePoints.origin.lat.toFixed(5)}, {routePoints.origin.lng.toFixed(5)}</div>}
                {routePoints.dest && <div>Dest: {routePoints.dest.lat.toFixed(5)}, {routePoints.dest.lng.toFixed(5)}</div>}
                {routeInfo && <div>Travel: {Math.round(routeInfo.duration/60)} min, {Math.round(routeInfo.distance)} m</div>}
              </div>
            </div>
      {/* Search and loading UI */}
      <div style={{position:'absolute', right:10, top:10, zIndex:1000, background:'#fff', padding:8, borderRadius:6, boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}>
        <div style={{fontWeight:700, marginBottom:6}}>Search facilities</div>
        <input placeholder="Search by name, type, attribute" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{width:240, marginBottom:6}} />
        <div style={{display:'flex', gap:6}}>
          <button onClick={()=>{ setSearchTerm('') }}>Clear</button>
        </div>
        {loading && <div style={{fontSize:12, marginTop:6}}>Loading data...</div>}
        {errorMsg && <div style={{color:'red', fontSize:12, marginTop:6}}>{errorMsg}</div>}
      </div>

      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="OSM Standard">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay name="Polygons">
            <GeoJSON data={polygons} style={categoryStyle} onEachFeature={onEachPolygon} />
        </LayersControl.Overlay>

        <LayersControl.Overlay name="Roads">
            <GeoJSON data={lines} style={{ color:'#333', weight:3 }} />
        </LayersControl.Overlay>
      </LayersControl>

        {polygons && <FitBounds geojson={polygons} />}

        {/* show user location */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {/* show simple heatmap as small circle markers */}
        {heatData && heatData.map(u=> (
          <CircleMarker key={u.id} center={[u.lat, u.lng]} radius={6} pathOptions={{ color:'rgba(200,0,0,0.6)', fillOpacity:0.4 }} />
        ))}

        {/* draw route if present */}
        {routeGeoJSON && (
          <GeoJSON data={routeGeoJSON} style={{ color:'#0066cc', weight:5, opacity:0.9 }} />
        )}

        <div style={{position:'absolute', left:10, top:10, zIndex:1000}}>
          <ReportForm mapRef={mapRef} />
        </div>

        <Legend />
    </MapContainer>
  )
}
