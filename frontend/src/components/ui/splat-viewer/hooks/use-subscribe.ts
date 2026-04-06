import { useCallback, useRef } from 'react';
export function useSubscribe<T>() {
    const listeners = useRef<((val: T) => void)[]>([]);
    const subscribe = useCallback((listener: (val: T) => void) => {
        listeners.current.push(listener);
        return () => { listeners.current = listeners.current.filter(l => l !== listener); };
    }, []);
    const notify = useCallback((val: T) => { listeners.current.forEach(l => l(val)); }, []);
    return [subscribe, notify] as const;
}
