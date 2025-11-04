/**
 * Accessibility Utilities
 * 
 * Helper functions for implementing WCAG 2.1 Level AA accessibility features.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Trap focus within a container (for modals, dialogs, etc.)
 * 
 * @param container - The container element to trap focus within
 * @returns Cleanup function to remove event listeners
 * 
 * @example
 * useEffect(() => {
 *   const modalElement = modalRef.current;
 *   if (modalElement && isOpen) {
 *     return trapFocus(modalElement);
 *   }
 * }, [isOpen]);
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableSelector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const focusableElements = Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector)
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  function handleTabKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }

  container.addEventListener('keydown', handleTabKey);

  // Focus first element
  firstElement?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * Custom hook to return focus to the previously focused element
 * 
 * Useful for modals and dialogs that should return focus when closed.
 * 
 * @example
 * function Modal({ isOpen, onClose }) {
 *   useFocusReturn();
 *   
 *   if (!isOpen) return null;
 *   return <div>Modal content</div>;
 * }
 */
export function useFocusReturn(): void {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store the currently focused element
    previousFocus.current = document.activeElement as HTMLElement;

    // Return focus on cleanup
    return () => {
      previousFocus.current?.focus();
    };
  }, []);
}

/**
 * Announce a message to screen readers using a live region
 * 
 * @param message - The message to announce
 * @param politeness - The politeness level ('polite' or 'assertive')
 * 
 * @example
 * announceToScreenReader('Item added to inventory', 'polite');
 * announceToScreenReader('Error: Invalid input', 'assertive');
 */
export function announceToScreenReader(
  message: string,
  politeness: 'polite' | 'assertive' = 'polite'
): void {
  // Find or create live region
  let liveRegion = document.getElementById('a11y-live-region');

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'a11y-live-region';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', politeness);
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
  } else {
    // Update politeness if needed
    liveRegion.setAttribute('aria-live', politeness);
  }

  // Clear existing content
  liveRegion.textContent = '';

  // Set new message after a brief delay (ensures announcement)
  setTimeout(() => {
    liveRegion!.textContent = message;
  }, 100);
}

/**
 * Custom hook to announce status messages to screen readers
 * 
 * @returns Function to announce a message
 * 
 * @example
 * function MyComponent() {
 *   const announce = useAnnounce();
 *   
 *   const handleAction = () => {
 *     // Do something
 *     announce('Action completed successfully');
 *   };
 * }
 */
export function useAnnounce(): (message: string, politeness?: 'polite' | 'assertive') => void {
  return (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, politeness);
  };
}

/**
 * Get a unique ID for associating labels with form controls
 * 
 * @param prefix - Optional prefix for the ID
 * @returns A unique ID string
 * 
 * @example
 * const inputId = useId('item-name');
 * <label htmlFor={inputId}>Name</label>
 * <input id={inputId} />
 */
let idCounter = 0;
export function generateId(prefix = 'a11y'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * Check if an element is focusable
 * 
 * @param element - The element to check
 * @returns True if the element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.hasAttribute('disabled')) return false;
  if (element.hasAttribute('tabindex') && element.getAttribute('tabindex') === '-1') return false;

  const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  return focusableTags.includes(element.tagName) || element.hasAttribute('tabindex');
}

/**
 * Get all focusable elements within a container
 * 
 * @param container - The container to search within
 * @returns Array of focusable elements
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
}

/**
 * Handle keyboard navigation in a list
 * 
 * @param event - Keyboard event
 * @param items - Array of elements to navigate
 * @param currentIndex - Currently focused item index
 * @param orientation - Navigation orientation ('vertical' or 'horizontal')
 * @returns New focused item index, or null if no change
 * 
 * @example
 * const newIndex = handleListNavigation(e, items, currentIndex, 'vertical');
 * if (newIndex !== null) {
 *   setFocusedIndex(newIndex);
 *   items[newIndex].focus();
 * }
 */
export function handleListNavigation(
  event: React.KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  orientation: 'vertical' | 'horizontal' = 'vertical'
): number | null {
  const nextKeys = orientation === 'vertical' ? ['ArrowDown'] : ['ArrowRight'];
  const prevKeys = orientation === 'vertical' ? ['ArrowUp'] : ['ArrowLeft'];
  const firstKeys = ['Home'];
  const lastKeys = ['End'];

  if (nextKeys.includes(event.key)) {
    event.preventDefault();
    return currentIndex < items.length - 1 ? currentIndex + 1 : 0; // Wrap to start
  }

  if (prevKeys.includes(event.key)) {
    event.preventDefault();
    return currentIndex > 0 ? currentIndex - 1 : items.length - 1; // Wrap to end
  }

  if (firstKeys.includes(event.key)) {
    event.preventDefault();
    return 0;
  }

  if (lastKeys.includes(event.key)) {
    event.preventDefault();
    return items.length - 1;
  }

  return null;
}

/**
 * Custom hook for managing roving tabindex in a list
 * 
 * Implements the roving tabindex pattern for keyboard navigation.
 * 
 * @param itemsCount - Number of items in the list
 * @param orientation - Navigation orientation ('vertical' or 'horizontal')
 * @returns Object with current index, navigation handler, and tabindex getter
 * 
 * @example
 * const { focusedIndex, handleKeyDown, getTabIndex } = useRovingTabIndex(items.length);
 * 
 * items.map((item, index) => (
 *   <button
 *     tabIndex={getTabIndex(index)}
 *     onKeyDown={handleKeyDown}
 *   >
 *     {item}
 *   </button>
 * ))
 */
export function useRovingTabIndex(
  _itemsCount: number,
  orientation: 'vertical' | 'horizontal' = 'vertical'
) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const items = Array.from(
      (event.currentTarget as HTMLElement).parentElement?.children ?? []
    ) as HTMLElement[];

    const newIndex = handleListNavigation(event, items, focusedIndex, orientation);

    if (newIndex !== null) {
      setFocusedIndex(newIndex);
      items[newIndex]?.focus();
    }
  };

  const getTabIndex = (index: number) => (index === focusedIndex ? 0 : -1);

  return { focusedIndex, handleKeyDown, getTabIndex, setFocusedIndex };
}

/**
 * Utility to detect if user prefers reduced motion
 * 
 * @returns True if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Custom hook to listen for reduced motion preference changes
 * 
 * @returns Boolean indicating if reduced motion is preferred
 * 
 * @example
 * const shouldReduceMotion = usePrefersReducedMotion();
 * const animationClass = shouldReduceMotion ? 'no-animation' : 'with-animation';
 */
export function usePrefersReducedMotion(): boolean {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(prefersReducedMotion());

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = () => {
      setShouldReduceMotion(mediaQuery.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Older browsers
    else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return shouldReduceMotion;
}
