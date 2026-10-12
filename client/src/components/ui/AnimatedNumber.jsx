import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

// Counts from the previous value to the new one; `format` renders each frame.
export default function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString(), duration = 0.9, className }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (value == null || Number.isNaN(value)) return undefined;
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration]);
  return <span className={className}>{value == null ? '—' : format(display)}</span>;
}
