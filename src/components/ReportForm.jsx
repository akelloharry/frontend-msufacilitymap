import React, { useState } from 'react'
import axios from 'axios'

export default function ReportForm({ mapRef }){
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('Open')

  const submit = async () =>{
    let lat, lng
    if(mapRef && mapRef.current){
      const center = mapRef.current.getCenter()
      lat = center.lat; lng = center.lng
    } else { return alert('Map not ready') }
    try{
      const r = await axios.post('http://localhost:4000/reports', { title, description, lat, lng })
      alert('Report submitted')
      setOpen(false)
      setTitle(''); setDescription('')
    }catch(e){ console.error(e); alert('Failed to submit') }
  }

  return (
    <div style={{background:'#fff', padding:8, borderRadius:6, boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}>
      <button onClick={()=>setOpen(o=>!o)} style={{marginBottom:6}}>{open ? 'Close' : 'Report Issue'}</button>
      {open && (
        <div style={{minWidth:240}}>
          <div><label>Title</label><br/><input value={title} onChange={e=>setTitle(e.target.value)} style={{width:'100%'}} /></div>
          <div><label>Description</label><br/><textarea value={description} onChange={e=>setDescription(e.target.value)} style={{width:'100%'}} /></div>
          <div style={{marginTop:6}}>
            <button onClick={submit}>Submit at map center</button>
          </div>
          <div style={{fontSize:11, marginTop:6}}>Report will use current map center as location. You can pan/zoom first.</div>
        </div>
      )}
    </div>
  )
}
