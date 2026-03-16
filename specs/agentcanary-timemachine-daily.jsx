import { useState, useEffect } from "react";

const COLORS = {
  bg: "#04070c",
  bgCard: "#080d16",
  bgCardHover: "#0c1220",
  y: "#ffc53d",
  g: "#34d399",
  r: "#f87171",
  o: "#fb923c",
  p: "#a78bfa",
  t1: "#e4e9f2",
  t2: "#8a9abc",
  t3: "#4a5a7a",
  border: "rgba(255,255,255,0.06)",
  borderLight: "rgba(255,255,255,0.10)",
};

const SESSIONS = [
  {
    id: "morning",
    label: "MORNING BRIEF",
    icon: "✳",
    color: COLORS.o,
    colorRgb: "251,146,60",
    time: "06:30 UTC",
    headline: ["Oil rips on Iran fears.", "BTC miners dump 8K.", "VIX holds above 22."],
    headlineColors: [COLORS.o, COLORS.r, COLORS.y],
    signal: { text: "OIL +3.2% — SUPPLY SHOCK", sentiment: "bearish" },
    pills: [
      { text: "↑ Stagflation", color: "o" },
      { text: "↑ Energy Risk", color: "r" },
      { text: "→ Late Cycle", color: "y" },
    ],
    body: 'Gauge at 61.2 — stagflation bias intensifying. WTI crude pushes to $81.40 (+3.2%) as Iran sanctions tighten supply outlook. BTC miners offloaded 8K BTC over 48 hours, pushing price to $69,800. VIX at 22.4, elevated but not panicking. DXY firm at 104.8. PCE data drops Friday — consensus expects +0.3% MoM.',
    score: null,
  },
  {
    id: "midday",
    label: "MARKET PULSE",
    icon: "◐",
    color: COLORS.y,
    colorRgb: "255,197,61",
    time: "13:00 UTC",
    headline: ["SPX claws back losses.", "Tech leads the bounce.", "Bonds flash warning."],
    headlineColors: [COLORS.g, COLORS.t1, COLORS.r],
    signal: { text: "SPX +0.8% — TECH ROTATION", sentiment: "bullish" },
    pills: [
      { text: "↑ Risk-On", color: "g" },
      { text: "↓ Vol Compression", color: "g" },
      { text: "↑ Duration Risk", color: "r" },
    ],
    body: 'SPX recovers to 5,180 (+0.8%) led by mega-cap tech. NVDA +3.1%, AAPL +1.8%. QQQ outperforming at +1.2%. But bonds tell a different story — 10Y yield pushes to 4.38%, highest since November. Credit spreads widening. Gold steady at $2,165. Market bifurcation: equities say risk-on, bonds say caution.',
    score: { accuracy: 0.78, label: "3 of 4 calls correct" },
  },
  {
    id: "signal",
    label: "SIGNAL SCAN",
    icon: "◐",
    color: COLORS.g,
    colorRgb: "52,211,153",
    time: "17:00 UTC",
    headline: ["Whale wallets accumulate.", "ETF flows flip positive.", "Regime holds stagflation."],
    headlineColors: [COLORS.g, COLORS.y, COLORS.o],
    signal: { text: "ETF +$340M NET — ACCUMULATION", sentiment: "bullish" },
    pills: [
      { text: "↑ Smart Money", color: "g" },
      { text: "↑ ETF Inflows", color: "g" },
      { text: "→ Regime Stable", color: "y" },
    ],
    body: 'On-chain: 4 whale wallets added 2,400 BTC in the last 6 hours. BTC ETF net inflows hit $340M, strongest day in 2 weeks. GBTC outflows slowing. Regime gauge steady at 61.2 — stagflation. Narrative score for "oil supply shock" peaks at 0.87. "BTC accumulation" narrative rising at 0.64, up from 0.41 yesterday.',
    score: null,
  },
  {
    id: "evening",
    label: "EVENING WRAP",
    icon: "◑",
    color: COLORS.p,
    colorRgb: "167,139,250",
    time: "21:00 UTC",
    headline: ["Day closes mixed.", "Oil story dominates.", "Watch PCE Friday."],
    headlineColors: [COLORS.t1, COLORS.o, COLORS.y],
    signal: { text: "MIXED CLOSE — OIL NARRATIVE PEAK", sentiment: "neutral" },
    pills: [
      { text: "→ Stagflation", color: "o" },
      { text: "↑ Narrative Peak", color: "y" },
      { text: "↓ Momentum", color: "r" },
    ],
    body: 'SPX closes +0.4% at 5,155. BTC ends at $70,200, recovering from morning lows. Oil the dominant story — WTI settles at $80.90 (+2.8%). VIX fades to 21.8. Regime gauge ticks to 60.8. Key watch: PCE Friday consensus +0.3% MoM. Hot print above 0.4% could trigger vol expansion. Michigan consumer sentiment also Friday — prior 76.9.',
    score: { accuracy: 0.82, label: "Regime call correct, 4 of 5 signals hit" },
  },
];

const ASSETS = [
  { name: "BTC", value: "$70,200", change: "-1.3%", dir: "down" },
  { name: "SPX", value: "5,155", change: "+0.4%", dir: "up" },
  { name: "WTI", value: "$80.90", change: "+2.8%", dir: "up" },
  { name: "VIX", value: "21.8", change: "-2.7%", dir: "down" },
  { name: "DXY", value: "104.8", change: "+0.1%", dir: "up" },
  { name: "GOLD", value: "$2,165", change: "+0.3%", dir: "up" },
];

const Sparkline = ({ data, color, width = 80, height = 28 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const sparkData = {
  BTC: [72100, 71800, 71200, 70600, 70100, 69800, 70200],
  SPX: [5120, 5105, 5095, 5130, 5160, 5180, 5155],
  WTI: [78.6, 79.1, 79.8, 80.5, 81.4, 81.0, 80.9],
  VIX: [20.8, 21.2, 22.0, 22.4, 22.1, 21.9, 21.8],
  DXY: [104.5, 104.6, 104.7, 104.8, 104.9, 104.8, 104.8],
  GOLD: [2155, 2158, 2160, 2162, 2165, 2168, 2165],
};

const SessionCard = ({ session, isActive, onClick, index }) => {
  const [hovered, setHovered] = useState(false);
  const sentimentColor =
    session.signal.sentiment === "bullish"
      ? COLORS.g
      : session.signal.sentiment === "bearish"
      ? COLORS.r
      : COLORS.y;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${COLORS.bgCard}, ${COLORS.bgCardHover})`
          : COLORS.bgCard,
        border: `1px solid ${isActive ? `rgba(${session.colorRgb},0.3)` : COLORS.border}`,
        borderRadius: 16,
        padding: "28px 32px",
        cursor: "pointer",
        transition: "all 0.3s ease",
        position: "relative",
        overflow: "hidden",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered
          ? `0 8px 32px rgba(${session.colorRgb},0.08)`
          : "none",
        opacity: 0,
        animation: `fadeSlideIn 0.5s ease ${index * 0.1}s forwards`,
      }}
    >
      {isActive && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${session.color}, transparent)`,
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              padding: "7px 16px",
              borderRadius: 100,
              background: `rgba(${session.colorRgb},0.08)`,
              border: `1px solid rgba(${session.colorRgb},0.25)`,
              color: session.color,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{session.icon}</span>
            {session.label}
          </div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: COLORS.t3,
            }}
          >
            {session.time}
          </span>
        </div>

        {session.score && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: COLORS.g,
              background: "rgba(52,211,153,0.06)",
              border: "1px solid rgba(52,211,153,0.2)",
              padding: "6px 14px",
              borderRadius: 100,
            }}
          >
            <span style={{ fontSize: 13 }}>✓</span>
            {Math.round(session.score.accuracy * 100)}% accurate
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: sentimentColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 1,
            color: sentimentColor,
          }}
        >
          {session.signal.text}
        </span>
      </div>

      <div style={{ marginBottom: 20 }}>
        {session.headline.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 800,
              fontSize: 28,
              lineHeight: 1.15,
              letterSpacing: -1,
              color: session.headlineColors[i],
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        {session.pills.map((pill, i) => {
          const pillColor = COLORS[pill.color];
          const rgb =
            pill.color === "g"
              ? "52,211,153"
              : pill.color === "r"
              ? "248,113,113"
              : pill.color === "o"
              ? "251,146,60"
              : "255,197,61";
          return (
            <span
              key={i}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.5,
                padding: "5px 12px",
                borderRadius: 100,
                color: pillColor,
                border: `1px solid rgba(${rgb},0.25)`,
                background: `rgba(${rgb},0.05)`,
              }}
            >
              {pill.text}
            </span>
          );
        })}
      </div>

      <p
        style={{
          fontFamily: "'Instrument Sans', sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
          color: COLORS.t2,
          margin: 0,
        }}
      >
        {session.body.split(/(\d[\d,.%$+\-KkMm]*)/g).map((part, i) =>
          /\d/.test(part) ? (
            <strong key={i} style={{ color: COLORS.t1, fontWeight: 600 }}>
              {part}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </p>
    </div>
  );
};

export default function TimeMachinePage() {
  const [activeSession, setActiveSession] = useState("morning");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        fontFamily: "'Instrument Sans', sans-serif",
        color: COLORS.t1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Instrument+Sans:wght@400;500;600;700;800&display=swap');

        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.07; }
          50% { opacity: 0.12; }
        }
        @keyframes slideRight {
          from { width: 0%; }
          to { width: 100%; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* Background grid */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(167,139,250,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167,139,250,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          zIndex: 0,
        }}
      />

      {/* Glows */}
      <div
        style={{
          position: "fixed",
          width: 900,
          height: 900,
          top: -400,
          left: -200,
          background: "radial-gradient(circle, rgba(255,197,61,0.06), transparent 60%)",
          zIndex: 0,
          animation: "pulseGlow 8s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "fixed",
          width: 700,
          height: 700,
          bottom: -300,
          right: -100,
          background: "radial-gradient(circle, rgba(167,139,250,0.04), transparent 60%)",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 32px",
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 0",
            borderBottom: `1px solid ${COLORS.border}`,
            opacity: 0,
            animation: "fadeIn 0.6s ease 0.1s forwards",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 10,
                height: 10,
                background: COLORS.y,
                borderRadius: "50%",
                boxShadow: `0 0 12px ${COLORS.y}40`,
              }}
            />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 2,
              }}
            >
              AGENT<span style={{ color: COLORS.y }}>CANARY</span>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: COLORS.t3,
                letterSpacing: 1,
              }}
            >
              ← MAR 13 &nbsp;&nbsp;|&nbsp;&nbsp; MAR 15 →
            </span>
          </div>
        </div>

        {/* Hero */}
        <div
          style={{
            padding: "48px 0 40px",
            opacity: 0,
            animation: "fadeSlideIn 0.6s ease 0.2s forwards",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 40,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: COLORS.t3,
                  letterSpacing: 2,
                  marginBottom: 12,
                  textTransform: "uppercase",
                }}
              >
                Daily Intel
              </div>
              <h1
                style={{
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontSize: 56,
                  fontWeight: 800,
                  letterSpacing: -2,
                  lineHeight: 1.05,
                  marginBottom: 16,
                }}
              >
                <span style={{ color: COLORS.t1 }}>March </span>
                <span style={{ color: COLORS.y }}>14</span>
                <span style={{ color: COLORS.t3 }}>, 2026</span>
              </h1>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    padding: "8px 18px",
                    borderRadius: 100,
                    background: "rgba(251,146,60,0.08)",
                    border: "1px solid rgba(251,146,60,0.3)",
                    color: COLORS.o,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: COLORS.o,
                      boxShadow: `0 0 8px ${COLORS.o}60`,
                    }}
                  />
                  STAGFLATION
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 22,
                    fontWeight: 800,
                    color: COLORS.o,
                    letterSpacing: -0.5,
                  }}
                >
                  61.2
                </div>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: COLORS.t3,
                  }}
                >
                  regime gauge
                </span>
              </div>
            </div>

            {/* Streak badge */}
            <div
              style={{
                background: "rgba(52,211,153,0.04)",
                border: "1px solid rgba(52,211,153,0.15)",
                borderRadius: 16,
                padding: "20px 24px",
                textAlign: "center",
                minWidth: 160,
              }}
            >
              <div
                style={{
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontSize: 36,
                  fontWeight: 800,
                  color: COLORS.g,
                  lineHeight: 1,
                  marginBottom: 6,
                }}
              >
                14
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  color: COLORS.g,
                  letterSpacing: 1.5,
                  opacity: 0.8,
                }}
              >
                DAY STREAK
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: COLORS.t3,
                  marginTop: 4,
                }}
              >
                regime calls correct
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Rail */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            marginBottom: 40,
            padding: "0 0 32px",
            borderBottom: `1px solid ${COLORS.border}`,
            opacity: 0,
            animation: "fadeSlideIn 0.5s ease 0.3s forwards",
          }}
        >
          {SESSIONS.map((s, i) => {
            const isActive = activeSession === s.id;
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <div
                  onClick={() => setActiveSession(s.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    gap: 8,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: isActive ? 14 : 10,
                      height: isActive ? 14 : 10,
                      borderRadius: "50%",
                      background: isActive ? s.color : COLORS.t3,
                      boxShadow: isActive ? `0 0 16px ${s.color}50` : "none",
                      transition: "all 0.3s ease",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: 1,
                      color: isActive ? s.color : COLORS.t3,
                      transition: "all 0.3s ease",
                    }}
                  >
                    {s.time}
                  </span>
                </div>
                {i < SESSIONS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: `linear-gradient(90deg, ${COLORS.t3}40, ${COLORS.t3}20)`,
                      marginTop: -16,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: 28,
            paddingBottom: 60,
          }}
        >
          {/* Brief Cards Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {SESSIONS.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                isActive={activeSession === session.id}
                onClick={() => setActiveSession(session.id)}
                index={i}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Assets */}
            <div
              style={{
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: "24px",
                opacity: 0,
                animation: "fadeSlideIn 0.5s ease 0.4s forwards",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: COLORS.t3,
                  marginBottom: 18,
                }}
              >
                KEY ASSETS
              </div>
              {ASSETS.map((asset) => (
                <div
                  key={asset.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        color: COLORS.t2,
                        marginBottom: 2,
                      }}
                    >
                      {asset.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Instrument Sans', sans-serif",
                        fontSize: 16,
                        fontWeight: 700,
                        color: COLORS.t1,
                      }}
                    >
                      {asset.value}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Sparkline
                      data={sparkData[asset.name]}
                      color={asset.dir === "up" ? COLORS.g : COLORS.r}
                    />
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        color: asset.dir === "up" ? COLORS.g : COLORS.r,
                        minWidth: 48,
                        textAlign: "right",
                      }}
                    >
                      {asset.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Active Narratives */}
            <div
              style={{
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: "24px",
                opacity: 0,
                animation: "fadeSlideIn 0.5s ease 0.5s forwards",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: COLORS.t3,
                  marginBottom: 18,
                }}
              >
                ACTIVE NARRATIVES
              </div>
              {[
                { name: "Oil Supply Shock", score: 0.87, phase: "PEAK", color: COLORS.o },
                { name: "BTC Accumulation", score: 0.64, phase: "RISING", color: COLORS.g },
                { name: "Stagflation Regime", score: 0.71, phase: "HOLDING", color: COLORS.y },
                { name: "Tech Rotation", score: 0.42, phase: "EARLY", color: COLORS.p },
              ].map((narrative) => (
                <div
                  key={narrative.name}
                  style={{
                    padding: "12px 0",
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Instrument Sans', sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                        color: COLORS.t1,
                      }}
                    >
                      {narrative.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 1,
                        color: narrative.color,
                        background: `${narrative.color}10`,
                        padding: "3px 8px",
                        borderRadius: 100,
                      }}
                    >
                      {narrative.phase}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 3,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${narrative.score * 100}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, ${narrative.color}60, ${narrative.color})`,
                        borderRadius: 2,
                        transition: "width 1s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Query Prompt */}
            <div
              style={{
                background: `linear-gradient(135deg, ${COLORS.bgCard}, rgba(167,139,250,0.04))`,
                border: `1px solid rgba(167,139,250,0.15)`,
                borderRadius: 16,
                padding: "20px 24px",
                opacity: 0,
                animation: "fadeSlideIn 0.5s ease 0.6s forwards",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: COLORS.p,
                  marginBottom: 12,
                  opacity: 0.8,
                }}
              >
                ASK THE RECORD
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid rgba(255,255,255,0.08)`,
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontSize: 13,
                  color: COLORS.t3,
                  cursor: "text",
                  marginBottom: 10,
                }}
              >
                Last time VIX held above 22 for 3 days...
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {["Regime shifts", "Whale alerts", "Best calls"].map((q) => (
                  <span
                    key={q}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      padding: "4px 10px",
                      borderRadius: 100,
                      background: "rgba(167,139,250,0.06)",
                      border: "1px solid rgba(167,139,250,0.15)",
                      color: COLORS.p,
                      cursor: "pointer",
                    }}
                  >
                    {q}
                  </span>
                ))}
              </div>
            </div>

            {/* API CTA */}
            <div
              style={{
                border: `1px dashed ${COLORS.border}`,
                borderRadius: 16,
                padding: "20px 24px",
                textAlign: "center",
                opacity: 0,
                animation: "fadeSlideIn 0.5s ease 0.7s forwards",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  color: COLORS.t3,
                  marginBottom: 6,
                }}
              >
                GET THIS DATA VIA API
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: COLORS.y,
                  opacity: 0.6,
                }}
              >
                /v1/intel/2026-03-14
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: `1px solid ${COLORS.border}`,
            padding: "24px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: 0,
            animation: "fadeIn 0.5s ease 0.8s forwards",
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: COLORS.t3,
              letterSpacing: 1,
            }}
          >
            agentcanary.ai
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: COLORS.t3,
            }}
          >
            Free 4× daily on Telegram
          </span>
        </div>
      </div>
    </div>
  );
}
