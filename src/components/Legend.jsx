import React from 'react'

export default function Legend(){
  return (
    <div style={{position:'absolute', right:10, bottom:10, background:'#fff', padding:8, borderRadius:6, boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}>
      <div style={{fontWeight:700, marginBottom:4}}>Legend</div>
      <div><span style={{display:'inline-block', width:16, height:12, background:'#8dd3c7', marginRight:6}}></span>Academic</div>
      <div><span style={{display:'inline-block', width:16, height:12, background:'#fb8072', marginRight:6}}></span>Hostel</div>
      <div><span style={{display:'inline-block', width:16, height:12, background:'#bebada', marginRight:6}}></span>Service</div>
      <div style={{fontSize:10, marginTop:6}}>Data: `MSU_Polygon_Facilities`, `MSU_Polyline_Facilities`</div>
    </div>
  )
}
