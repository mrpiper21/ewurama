import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

// A polaroid of her that slowly "develops", tilts toward your fingertip, and catches the light.
export default function Polaroid({ src, caption = 'Ewurama ♡', delay = 0.4, className = '' }) {
  const ref = useRef(null)
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rx = useSpring(useTransform(my, [0, 1], [14, -14]), { stiffness: 120, damping: 14 })
  const ry = useSpring(useTransform(mx, [0, 1], [-16, 16]), { stiffness: 120, damping: 14 })
  const glareX = useTransform(mx, [0, 1], ['0%', '100%'])
  const glareY = useTransform(my, [0, 1], ['0%', '100%'])

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width)
    my.set((e.clientY - r.top) / r.height)
  }
  const onLeave = () => {
    mx.set(0.5)
    my.set(0.5)
  }

  return (
    <motion.div
      className={`polaroid-wrap ${className}`}
      initial={{ y: -500, rotate: -28, opacity: 0 }}
      animate={{ y: 0, rotate: -4, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 40, damping: 9, mass: 1.2 }}
    >
      <motion.div ref={ref} className="polaroid" style={{ rotateX: rx, rotateY: ry }} onPointerMove={onMove} onPointerLeave={onLeave}>
        <span className="tape" />
        <div className="polaroid-photo">
          <motion.img
            src={src}
            alt="Ewurama smiling"
            initial={{ filter: 'sepia(1) brightness(0.15) contrast(0.6) blur(6px) saturate(0)' }}
            animate={{ filter: 'sepia(0.08) brightness(1.02) contrast(1.04) blur(0px) saturate(1.08)' }}
            transition={{ delay: delay + 1.2, duration: 5, ease: 'easeOut' }}
          />
          <motion.div className="glare" style={{ '--gx': glareX, '--gy': glareY }} />
        </div>
        <motion.p
          className="polaroid-caption"
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={{ delay: delay + 3.5, duration: 2.2, ease: 'easeInOut' }}
        >
          {caption}
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
