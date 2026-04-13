import React, { createContext, useContext, useState } from 'react';
import { TourProvider, TourStep } from 'modern-tour';

interface PageTourContextValue {
  setSteps: (steps: TourStep[]) => void;
}

const PageTourContext = createContext<PageTourContextValue>({ setSteps: () => {} });

export const usePageTourContext = () => useContext(PageTourContext);

export const TourManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [steps, setSteps] = useState<TourStep[]>([]);

  return (
    <PageTourContext.Provider value={{ setSteps }}>
      <TourProvider options={{ steps }}>
        {children}
      </TourProvider>
    </PageTourContext.Provider>
  );
};
