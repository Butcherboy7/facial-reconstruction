// Single icon family: 1.75px rounded stroke, 24px grid
const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
type P = { size?: number; className?: string }
const mk = (d: React.ReactNode) => ({ size = 16, className }: P) => <svg {...base} width={size} height={size} className={className}>{d}</svg>
export const Check = mk(<path d="M5 12.5l4.5 4.5L19 7.5" />)
export const ArrowRight = mk(<path d="M5 12h14M13 6l6 6-6 6" />)
export const ArrowLeft = mk(<path d="M19 12H5M11 6l-6 6 6 6" />)
export const Rotate = mk(<><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></>)
export const Chevron = mk(<path d="M9 6l6 6-6 6" />)
export const Plus = mk(<path d="M12 5v14M5 12h14" />)
export const Print = mk(<><path d="M7 9V4h10v5" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M7 14h10v6H7z" /></>)
export const Scan = mk(<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M4 12h16" /></>)
