import { useEffect } from 'react';
import { useTour, TourStep } from 'modern-tour';
import { usePageTourContext } from '../contexts/PageTourContext';

/**
 * Registers page-specific tour steps and clears them on unmount.
 * Pass a stable (memoised) array to avoid redundant re-registrations.
 */
export function usePageTour(steps: TourStep[]) {
  const { setSteps } = usePageTourContext();
  const { stop } = useTour();

  useEffect(() => {
    setSteps(steps);
    return () => {
      stop();
      setSteps([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);
}
