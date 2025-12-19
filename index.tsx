import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
// Temporarily disable full app to debug black screen
// import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <div style={{ color: 'white', padding: 40, fontSize: 24 }}>
    TEST RENDER FROM INDEX.TSX
  </div>
);