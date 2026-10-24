/** Original vector geometry inspired by the supplied gold orbital emblem. */
export function OrbitalEmblem() {
  return (
    <svg viewBox="0 0 100 100" className="orbital-emblem" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="50" cy="50" r="7" fill="currentColor" />
      <g className="orbital-emblem-orbit">
        <circle cx="50" cy="50" r="24" fill="none" stroke="currentColor" strokeWidth="3.5"
          strokeLinecap="round" pathLength="360" strokeDasharray="140 40 140 40" transform="rotate(-25 50 50)" />
        <circle cx="66.97" cy="33.03" r="4.3" fill="currentColor" />
        <circle cx="33.03" cy="66.97" r="4.3" fill="currentColor" />
      </g>
    </svg>
  );
}
