import { useEffect, useRef } from 'react';

/**
 * useParallax Hook
 * 
 * Creates parallax scrolling effect on an element.
 * Element moves slower than scroll speed for depth effect.
 * 
 * @param speed - Parallax speed multiplier (0.5 = half scroll speed, default)
 * @returns ref - Ref to attach to element that should have parallax effect
 * 
 * Usage:
 * ```tsx
 * const parallaxRef = useParallax(0.5);
 * return (
 *   <img
 *     ref={parallaxRef}
 *     src="/image.jpg"
 *     className="parallax-image"
 *   />
 * );
 * ```
 * 
 * Note: Add `will-change: transform` CSS for GPU acceleration:
 * .parallax-image {
 *   will-change: transform;
 * }
 */
export const useParallax = (speed = 0.5) => {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!elementRef.current) return;

      // Get current scroll position
      const scrolled = window.pageYOffset;
      
      // Calculate parallax offset
      const rate = scrolled * speed;
      
      // Apply transform
      elementRef.current.style.transform = `translateY(${rate}px)`;
    };

    // Use passive listener for better scroll performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial position
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [speed]);

  return elementRef;
};
