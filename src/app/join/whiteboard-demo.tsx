// Animated (CSS-only) whiteboard showing a Class 7 triangle-inequality doubt.
// Keyframes live in globals.css under "Join page whiteboard demo".

const step = (i: number) => ({ animationName: `wb-s${i}` });

export function WhiteboardDemo() {
  return (
    <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-ink px-5 py-3 text-sm text-white">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sage" /> Live whiteboard · demo
        </span>
        <span className="text-white/70">Class 7 · Triangles</span>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-ink/10 bg-cream/40 p-4">
          <p className="wb-step text-base font-semibold text-ink" style={step(0)}>
            Can sides <b>3 cm, 4 cm, 8 cm</b> make a triangle? 🤔
          </p>

          <svg viewBox="0 0 280 170" className="mt-2 w-full max-w-sm" role="img"
            aria-label="Sides of 3 and 4 centimetres cannot reach across an 8 centimetre base">
            <g className="wb-step" style={step(1)}>
              <line x1="20" y1="150" x2="260" y2="150" stroke="#1e1e2f" strokeWidth="4" strokeLinecap="round" />
              <text x="140" y="167" textAnchor="middle" fontSize="13" fill="#1e1e2f">8 cm</text>
            </g>
            <g className="wb-step" style={step(2)}>
              <line x1="20" y1="150" x2="104.6" y2="119.2" stroke="#5f9e46" strokeWidth="4" strokeLinecap="round" />
              <text x="48" y="122" fontSize="13" fill="#5f9e46">3 cm</text>
              <line x1="260" y1="150" x2="147.2" y2="109" stroke="#e8864a" strokeWidth="4" strokeLinecap="round" />
              <text x="210" y="116" fontSize="13" fill="#e8864a">4 cm</text>
            </g>
            <g className="wb-step" style={step(3)}>
              <line x1="104.6" y1="119.2" x2="147.2" y2="109" stroke="#dc2626" strokeWidth="2" strokeDasharray="4 4" />
              <text x="126" y="98" textAnchor="middle" fontSize="12" fill="#dc2626">gap!</text>
            </g>
          </svg>

          <div className="mt-1 space-y-1 font-mono text-[15px] text-ink">
            <p className="wb-step" style={step(4)}>Rule: a + b &gt; c</p>
            <p className="wb-step" style={step(5)}>3 + 4 = 7</p>
            <p className="wb-step font-bold text-red-600" style={step(6)}>
              7 &lt; 8 ✗ Not a triangle
            </p>
          </div>
        </div>

        <div className="hidden w-36 flex-col items-center justify-center rounded-2xl bg-sage/20 p-4 text-center sm:flex">
          <span className="text-4xl">👩🏽‍🏫</span>
          <p className="mt-2 text-sm font-semibold text-ink">Maths tutor</p>
          <div className="mt-2 flex h-4 items-end gap-0.5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="wb-voice w-1 rounded-full bg-sage-deep"
                style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
          <p className="mt-2 text-xs text-ink/60">Explaining step by step</p>
        </div>
      </div>
      <p className="border-t border-ink/10 px-5 py-2 text-right text-xs text-ink/50">
        Simulated lesson · not a real call
      </p>
    </div>
  );
}
