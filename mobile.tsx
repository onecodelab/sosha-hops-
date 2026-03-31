import React from 'react'
import ReactDOM from 'react-dom/client'

function MobileApp() {
  return (
    <div style={{
      backgroundColor: '#000',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Baro OS</h1>
      <p style={{ color: '#888' }}>Mobile App Shell — Ready</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('mobile-root')!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
)
