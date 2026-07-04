import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './PageTransition.css';

export default function PageTransition({ children }) {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation on route change
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className={`page-transition ${isVisible ? 'page-visible' : ''}`}>
      {children}
    </div>
  );
}
