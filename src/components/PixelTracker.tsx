import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageview } from '@/lib/pixel';

export const PixelTracker = () => {
  const location = useLocation();

  useEffect(() => {
    pageview();
  }, [location.pathname, location.search]);

  return null;
};

export default PixelTracker;
