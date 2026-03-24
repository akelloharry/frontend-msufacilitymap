import React, { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, LayersControl, Marker, CircleMarker, useMap, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import axios from 'axios'
import Legend from './Legend'
import ReportForm from './ReportForm'

// Default center (Maseno Main Campus)
const DEFAULT_CENTER = [0.0845,34.6460]

function FitBounds({ geojson }){
  const map = useMap()
  useEffect(()=>{
    if(!geojson) return
    try{ const layer = L.geoJSON(geojson); map.fitBounds(layer.getBounds(), { maxZoom:17 }) }catch(e){}
  },[geojson])
  return null
}

export default function MapComponent(){
  const [polygons, setPolygons] = useState(null)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const [lines, setLines] = useState(null)
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
        // post once
        axios.post('http://localhost:4000/users/location',{ user_id: 'anon', lat: loc.lat, lng: loc.lng }).catch(()=>{})
      })
      // optional: watchPosition could be used
    }
    return ()=>{ if(id) navigator.geolocation.clearWatch(id) }
  },[])

  useEffect(()=>{
    // Load polygons and lines from backend
    axios.get(`${API_BASE}/features/polygons`).then(r=>{
      const features = { type: 'FeatureCollection', features: r.data.map(item => ({ type:'Feature', geometry:item.geometry, properties:item.properties })) }
      setPolygons(features)
    }).catch(console.error)

    axios.get(`${API_BASE}/features/lines`).then(r=>{
      const features = { type: 'FeatureCollection', features: r.data.map(item => ({ type:'Feature', geometry:item.geometry, properties:item.properties })) }
      setLines(features)
    }).catch(console.error)

    axios.get(`${API_BASE}/users/locations`).then(r=>{
      setHeatData(r.data)
    }).catch(console.error)
  },[])

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
          const start = `${routePoints.origin.lat},${routePoints.origin.lng}`
          const end = `${routePoints.dest.lat},${routePoints.dest.lng}`
          const r = await axios.get(`${API_BASE}/route?start=${start}&end=${end}`)
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
        // If we have user location, compute walking route via backend proxy
        if(userLocation){
          // compute centroid of feature
          const tmp = L.geoJSON(feature)
          const center = tmp.getBounds().getCenter()
          const start = `${userLocation.lat},${userLocation.lng}`
          const end = `${center.lat},${center.lng}`
          const r = await axios.get(`${API_BASE}/route?start=${start}&end=${end}`)
          if(r.data && r.data.routes && r.data.routes[0]){
            const route = r.data.routes[0]
            setRouteGeoJSON(route.geometry)
            setRouteInfo({ duration: route.duration, distance: route.distance })
            // open popup with travel time
            layer.bindPopup(`<div><strong>${props.name||'Feature'}</strong><br/>Walking time: ${Math.round(route.duration/60)} min<br/>Distance: ${Math.round(route.distance)} m</div>`).openPopup()
          }
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
