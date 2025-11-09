import { useEffect, useRef, useState } from 'react';

/**
 * useScrollAnimation Hook
 * 
 * Triggers fade-in animation when element scrolls into view.
 * Uses IntersectionObserver for performance.
 * 
 * @param options - IntersectionObserver options
 * @returns [ref, isVisible] - Ref to attach to element and visibility state
 * 
 * Usage:
 * ```tsx
 * const [ref, isVisible] = useScrollAnimation();
 * return (
 *   <div
 *     ref={ref}
 *     className={cn(
 *       "opacity-0 translate-y-8 transition-all duration-700",
 *       isVisible && "opacity-100 translate-y-0"
 *     )}
 *   >
 *     Content
 *   </div>
 * );
 * ```
 */
export const useScrollAnimation = (options: IntersectionObserverInit = {}) => {
  const elementRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Trigger once - unobserve after animation starts
          if (elementRef.current) {
            observer.unobserve(elementRef.current);
          }
        }
      },
      {
        threshold: 0.3, // Trigger when 30% visible
        ...options,
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return [elementRef, isVisible] as const;
};
