import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/main.css';
import './themes/gallery.css';
import { DemoGallery } from './DemoGallery.jsx';

document.body.classList.add('demo-gallery-body');

createRoot(document.getElementById('demo-root')).render(
  <StrictMode>
    <DemoGallery />
  </StrictMode>
);

// Spinner keyframe used by login loading state
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);
