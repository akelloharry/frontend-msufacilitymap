import React, { useState } from 'react'
import axios from 'axios'
import { supabase } from '../supabaseClient'

export default function ReportForm({ mapRef }){
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('Open')
  const [useDeviceLocation, setUseDeviceLocation] = useState(true)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [routingMode, setRoutingMode] = useState('Walk')
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')

  async function uploadPhoto(fileObj){
    if(!supabase || !fileObj) return null
    try{
      const name = `reports/${Date.now()}-${fileObj.name}`
      const { error } = await supabase.storage.from('reports').upload(name, fileObj, { cacheControl: '3600', upsert: false })
      if(error) throw error
      const { data } = await supabase.storage.from('reports').getPublicUrl(name)
      return data.publicUrl
    }catch(e){ console.error('Photo upload failed', e); return null }
  }

  const submit = async () =>{
    // Determine location: device preferred, else map center
    let lat = null, lng = null
    if(useDeviceLocation){
      try{
        const pos = await new Promise((resolve, reject)=>{
          if(!navigator.geolocation) return reject(new Error('No geolocation'))
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        })
        lat = pos.coords.latitude; lng = pos.coords.longitude
      }catch(e){ /* fall back below */ }
    }
    if((lat === null || lng === null) && mapRef && mapRef.current){ const center = mapRef.current.getCenter(); lat = center.lat; lng = center.lng }
    if(!lat || !lng) return alert('Unable to determine location')

    let photoUrl = null
    if(file){ setUploading(true); photoUrl = await uploadPhoto(file); setUploading(false) }

    try{
      if(supabase){
        const payload = { description, location: `SRID=4326;POINT(${lng} ${lat})`, photo_url: photoUrl, facility_id: null }
        const { data, error } = await supabase.from('facility_reports').insert([payload])
        if(error) throw error
      } else {
        await axios.post('http://localhost:4000/reports', { title, description, lat, lng, routing_mode: routingMode, from_text: fromText, to_text: toText })
      }
      alert('Report submitted')
      setOpen(false)
      setTitle(''); setDescription(''); setFile(null); setFromText(''); setToText('')
    }catch(e){ console.error(e); alert('Failed to submit') }
  }

  return (
    <div style={{background:'#fff', padding:8, borderRadius:6, boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}>
      <button onClick={()=>setOpen(o=>!o)} style={{marginBottom:6}}>{open ? 'Close' : 'Report Issue'}</button>
      {open && (
        <div style={{minWidth:280}}>
          <div style={{fontWeight:700, marginBottom:6}}>Report an Issue</div>
          <div style={{marginBottom:6}}>
            <label><input type="checkbox" checked={useDeviceLocation} onChange={e=>setUseDeviceLocation(e.target.checked)} /> Use my location</label>
          </div>
          <div style={{marginBottom:6}}><label>Title</label><br/><input value={title} onChange={e=>setTitle(e.target.value)} style={{width:'100%'}} /></div>
          <div style={{marginBottom:6}}><label>Description</label><br/><textarea value={description} onChange={e=>setDescription(e.target.value)} style={{width:'100%'}} /></div>
          <div style={{marginBottom:6}}>
            <label>Photo (optional)</label><br/>
            <input type="file" accept="image/*" onChange={e=>setFile(e.target.files && e.target.files[0])} />
          </div>
          <div style={{marginBottom:6}}>
            <label>Routing Mode</label><br/>
            <select value={routingMode} onChange={e=>setRoutingMode(e.target.value)}>
              <option>Walk</option>
              <option>Drive</option>
              <option>Cycle</option>
            </select>
          </div>
          <div style={{marginBottom:6}}>
            <label>From</label><br/>
            <input value={fromText} onChange={e=>setFromText(e.target.value)} style={{width:'100%'}} placeholder="From (Destination)" />
            <div style={{marginTop:4}}><button onClick={()=>{ if(mapRef && mapRef.current){ const c=mapRef.current.getCenter(); setFromText(`${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`) }}}>Use map center</button></div>
          </div>
          <div style={{marginBottom:6}}>
            <label>To</label><br/>
            <input value={toText} onChange={e=>setToText(e.target.value)} style={{width:'100%'}} placeholder="To (Destination)" />
            <div style={{marginTop:4}}><button onClick={()=>{ if(mapRef && mapRef.current){ const c=mapRef.current.getCenter(); setToText(`${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`) }}}>Use map center</button></div>
          </div>

          <div style={{display:'flex', gap:8}}>
            <button onClick={submit} disabled={uploading}>{uploading ? 'Uploading...' : 'Report Issue'}</button>
            <button onClick={()=>{ setTitle(''); setDescription(''); setFile(null); setFromText(''); setToText('') }}>Clear</button>
          </div>
          <div style={{fontSize:11, marginTop:6}}>Not signed in</div>
        </div>
      )}
    </div>
  )
}
