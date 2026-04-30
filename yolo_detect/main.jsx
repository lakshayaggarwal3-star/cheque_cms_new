import React from 'react'
import ReactDOM from 'react-dom/client'
import YOLODetector from './yolo-detector.jsx'
import YOLOSegmenter from './yolo-segmenter.jsx'
import YOLOEditor from './yolo-editor.jsx'

const App = () => {
  // Simple path-based routing
  const [path, setPath] = React.useState(window.location.pathname);

  // Listen for back/forward buttons
  React.useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (path === '/segmenter') {
    return <YOLOSegmenter />;
  }
  
  if (path === '/editor') {
    return <YOLOEditor />;
  }
  
  return <YOLODetector />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
