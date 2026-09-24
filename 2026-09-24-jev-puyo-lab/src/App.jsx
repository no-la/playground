import React, { useEffect, useRef, useState } from "react";
import {
  COLS,
  ROWS,
  EMPTY,
  GARBAGE,
  emptyBoard,
  createSequence,
  enumerateMoves,
  heuristicMove,
  forecastChains,
  boardToText,
  dropGarbage,
  isGameOver,
} from "../engine.js";
const C = ["#ed385d", "#329cf5", "#42d76f", "#f5c329", "#d8e3ff"],
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MODES = [
    ["heuristic", "HEURISTIC"],
    ["direct", "JEV DIRECT"],
    ["jury", "JEV JURY"],
  ],
  STRATEGIES = [
    ["balanced", "BALANCED"],
    ["chain", "10-CHAIN"],
    ["clear", "QUICK CLEAR"],
    ["survive", "SURVIVAL"],
  ];
const NOTES = {
  balanced: "生存・連鎖・得点をバランスよく評価",
  chain: "8手先を探索して10連鎖以上を設計",
  clear: "消せるぷよを早めに得点化",
  survive: "高さ・穴・凹凸を抑えて生存",
};
const fresh = (id, mode = "heuristic", strategy = "chain") => ({
  id,
  board: emptyBoard(),
  score: 0,
  maxChain: 0,
  pending: 0,
  alive: true,
  mode,
  strategy,
  last: "判断待ち",
  confidence: null,
  effect: null,
  next: [],
});
function Board({ p, label }) {
  const ref = useRef();
  useEffect(() => {
    const x = ref.current.getContext("2d"),
      w = 60,
      h = 60,
      blob = (col, row, color, alpha = 1) => {
        const px = col * w + 3,
          py = (row - 1) * h + 3,
          s = 54;
        x.save();
        x.globalAlpha = alpha;
        x.fillStyle = C[color];
        x.shadowColor = C[color];
        x.shadowBlur = color === GARBAGE ? 2 : 10;
        x.beginPath();
        x.roundRect(px, py, s, s, 23);
        x.fill();
        x.shadowBlur = 0;
        x.fillStyle = color === GARBAGE ? "#64708d" : "#fff";
        x.beginPath();
        x.ellipse(px + 21, py + 28, 4, 6, 0, 0, 7);
        x.ellipse(px + 33, py + 28, 4, 6, 0, 0, 7);
        x.fill();
        x.restore();
      };
    x.clearRect(0, 0, 360, 720);
    let g = x.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, "#101e55");
    g.addColorStop(1, "#060b23");
    x.fillStyle = g;
    x.fillRect(0, 0, 360, 720);
    x.strokeStyle = "rgba(115,158,255,.07)";
    for (let i = 1; i < 6; i++) {
      x.beginPath();
      x.moveTo(i * w, 0);
      x.lineTo(i * w, 720);
      x.stroke();
    }
    for (let r = 1; r < 12; r++) {
      x.beginPath();
      x.moveTo(0, r * h);
      x.lineTo(360, r * h);
      x.stroke();
    }
    for (let r = 1; r < ROWS; r++)
      for (let col = 0; col < COLS; col++)
        if (p.board[r][col] !== EMPTY) blob(col, r, p.board[r][col]);
    const e = p.effect;
    if (e?.moving)
      for (const q of e.moving)
        blob(q.col, q.from + (q.to - q.from) * e.progress, q.color);
    if (e?.type === "clear")
      for (const q of e.cells) {
        x.strokeStyle = "#fff";
        x.lineWidth = 4 + 9 * e.progress;
        x.shadowColor = C[q.color];
        x.shadowBlur = 28;
        x.beginPath();
        x.arc((q.col + 0.5) * w, (q.r - 0.5) * h, 24 + 12 * e.progress, 0, 7);
        x.stroke();
        x.shadowBlur = 0;
      }
    if (e?.type === "burst")
      for (const q of e.cells)
        for (let i = 0; i < 7; i++) {
          const a = (i * Math.PI * 2) / 7,
            d = 45 * e.progress;
          x.globalAlpha = 1 - e.progress;
          x.fillStyle = C[q.color];
          x.beginPath();
          x.arc(
            (q.col + 0.5) * w + Math.cos(a) * d,
            (q.r - 0.5) * h + Math.sin(a) * d,
            5,
            0,
            7,
          );
          x.fill();
        }
    x.globalAlpha = 1;
  }, [p]);
  return (
    <div className="board-shell">
      <div className="board-top">
        <b>{label}</b>
        <span>{p.alive ? "ACTIVE" : "DOWN"}</span>
      </div>
      <canvas ref={ref} width="360" height="720" />
      {p.effect?.chain && (
        <div className="chain-pop">
          {p.effect.chain} CHAIN!<small>{p.effect.count} PUYO POP</small>
        </div>
      )}
    </div>
  );
}
const Select = ({ value, onChange, items }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}>
    {items.map(([v, l]) => (
      <option key={v} value={v}>
        {l}
      </option>
    ))}
  </select>
);
function NextQueue({ pairs }) {
  return (
    <div className="next">
      <span>NEXT</span>
      {pairs.slice(0, 2).map((pair, i) => (
        <div className="next-pair" key={i}>
          {pair.map((color, j) => (
            <i key={j} style={{ background: C[color] }} />
          ))}
        </div>
      ))}
    </div>
  );
}
function PlayerPanel({ p, set, label }) {
  return (
    <aside className="panel">
      <span className="label">{label} PLAYER</span>
      <Select
        value={p.mode}
        onChange={(v) => set({ ...p, mode: v })}
        items={MODES}
      />
      <span className="label sub">STRATEGY / PROMPT</span>
      <Select
        value={p.strategy}
        onChange={(v) => set({ ...p, strategy: v })}
        items={STRATEGIES}
      />
      <p className="note">{NOTES[p.strategy]}</p>
      <NextQueue pairs={p.next} />
      <div className="score">
        <span>SCORE</span>
        <strong>{String(p.score).padStart(8, "0")}</strong>
      </div>
      <div className="metrics">
        <div>
          <span>MAX CHAIN</span>
          <b>{p.maxChain}</b>
        </div>
        <div>
          <span>OJAMA</span>
          <b>{p.pending}</b>
        </div>
      </div>
      <div className="decision">
        <span>LAST DECISION</span>
        <strong>{p.last}</strong>
        {p.confidence != null && (
          <small>CONF. {Math.round(p.confidence * 100)}%</small>
        )}
      </div>
    </aside>
  );
}
function Header({ view, setView }) {
  return (
    <header>
      <div>
        <p className="kicker">SYSTEM ONE ARCADE / EXPERIMENT 03</p>
        <h1>
          <span>JEV</span> PUYO LAB
        </h1>
      </div>
      <nav>
        <button
          className={view === "solo" ? "active" : ""}
          onClick={() => setView("solo")}
        >
          SOLO
        </button>
        <button
          className={view === "battle" ? "active" : ""}
          onClick={() => setView("battle")}
        >
          BATTLE
        </button>
      </nav>
    </header>
  );
}
const safe = (m) => m.map(({ resultBoard, steps, cells, ...x }) => x);
async function choose(p, pair, next, seq, i) {
  if (isGameOver(p.board)) return null;
  const moves = enumerateMoves(p.board, pair);
  if (!moves.length) return null;
  if (p.strategy === "chain") {
    const f = forecastChains(moves, seq.slice(i + 1, i + 9));
    moves.forEach((m) => Object.assign(m, f.get(m.id)));
  }
  if (p.mode === "heuristic") {
    const move =
      p.strategy === "chain"
        ? [...moves].sort((a, b) => b.forecastValue - a.forecastValue)[0]
        : heuristicMove(moves, p.strategy);
    return {
      move,
      d: {
        posture:
          p.strategy === "chain"
            ? `10-chain forecast ${move.forecastChain}`
            : `${p.strategy} heuristic`,
        confidence: 1,
      },
    };
  }
  const finalists =
      p.strategy === "chain"
        ? [...moves]
            .sort((a, b) => b.forecastValue - a.forecastValue)
            .slice(0, 2)
        : moves,
    r = await fetch("/api/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        board: boardToText(p.board),
        pair: "RGBY"[pair[0]] + "RGBY"[pair[1]],
        next: "RGBY"[next[0]] + "RGBY"[next[1]],
        candidates: safe(finalists),
        mode: p.mode,
        strategy: p.strategy,
      }),
    }),
    d = await r.json();
  if (!r.ok) throw Error(d.error);
  return { move: moves.find((m) => m.id === d.moveId) || finalists[0], d };
}
async function tween(p, set, run, token, duration, update) {
  const start = performance.now();
  while (performance.now() - start < duration) {
    if (run !== token.current) return false;
    update(Math.min(1, (performance.now() - start) / duration));
    set({ ...p });
    await sleep(16);
  }
  return true;
}
function gravityMotion(from, to) {
  const base = from.map((r) => [...r]),
    moving = [];
  for (let col = 0; col < COLS; col++) {
    const a = [],
      b = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (from[r][col] !== EMPTY) a.push({ r, color: from[r][col] });
      if (to[r][col] !== EMPTY) b.push({ r, color: to[r][col] });
    }
    a.forEach((q, i) => {
      if (b[i] && q.r !== b[i].r) {
        base[q.r][col] = EMPTY;
        moving.push({ col, from: q.r, to: b[i].r, color: q.color });
      }
    });
  }
  return { base, moving };
}
async function applyChoice(p, c, pair, set, run, token) {
  const rot = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ][c.move.rotation],
    spawn = [
      { col: c.move.col, row: 1 },
      { col: c.move.col + rot[0], row: 1 + rot[1] },
    ],
    moving = c.move.cells.map((q, i) => ({
      col: q.col,
      from: spawn[i].row,
      to: q.row,
      color: pair[q.colorIndex],
    }));
  p.effect = { type: "drop", moving, progress: 0 };
  if (
    !(await tween(
      p,
      set,
      run,
      token,
      220,
      (t) => (p.effect.progress = 1 - (1 - t) ** 3),
    ))
  )
    return false;
  p.effect = null;
  let credited = 0;
  for (const step of c.move.steps) {
    const cells = step.groups.flatMap((g) =>
      g.cells.map(([r, col]) => ({ r, col, color: g.color })),
    );
    p.board = step.beforeBoard;
    p.effect = {
      type: "clear",
      cells,
      progress: 0,
      chain: step.chain,
      count: step.count,
    };
    if (!(await tween(p, set, run, token, 430, (t) => (p.effect.progress = t))))
      return false;
    p.board = step.poppedBoard;
    p.effect = {
      type: "burst",
      cells,
      progress: 0,
      chain: step.chain,
      count: step.count,
    };
    p.score += step.score;
    credited += step.score;
    p.maxChain = Math.max(p.maxChain, step.chain);
    if (!(await tween(p, set, run, token, 280, (t) => (p.effect.progress = t))))
      return false;
    const g = gravityMotion(step.poppedBoard, step.afterBoard);
    p.board = g.base;
    p.effect = g.moving.length
      ? { type: "gravity", moving: g.moving, progress: 0 }
      : null;
    if (
      g.moving.length &&
      !(await tween(
        p,
        set,
        run,
        token,
        300,
        (t) => (p.effect.progress = 1 - (1 - t) ** 3),
      ))
    )
      return false;
    p.board = step.afterBoard;
    p.effect = null;
    set({ ...p });
    await sleep(160);
  }
  p.board = c.move.resultBoard;
  p.score += c.move.score - credited;
  p.maxChain = Math.max(p.maxChain, c.move.chains);
  p.last = `${c.move.label} · ${c.d.posture || "jury"}`;
  p.confidence = c.d.confidence;
  p.effect = null;
  p.alive = !isGameOver(p.board);
  set({ ...p });
  return true;
}
function Controls({ seed, setSeed, start, pause, paused }) {
  return (
    <div className="controls">
      <label>
        SEQUENCE SEED
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(+e.target.value)}
        />
      </label>
      <button className="start" onClick={start}>
        START RUN
      </button>
      <button onClick={pause}>{paused ? "RESUME" : "PAUSE"}</button>
    </div>
  );
}
function Trace({ logs }) {
  return (
    <section className="trace">
      <p className="kicker">DECISION TRACE</p>
      <h2>一手ごとの判断</h2>
      {logs.map((l, i) => (
        <p className="trace-row" key={i}>
          <b>{l.n}</b>
          <span>{l.text}</span>
        </p>
      ))}
    </section>
  );
}
function Solo() {
  const [seed, setSeed] = useState(4242),
    [p, setP] = useState(fresh("p1")),
    [paused, setPaused] = useState(false),
    [logs, setLogs] = useState([]),
    token = useRef(0),
    pauseRef = useRef(false);
  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );
  const start = () => {
    let run = ++token.current,
      seq = createSequence(seed),
      x = fresh("p1", p.mode, p.strategy);
    setP({ ...x });
    setLogs([]);
    pauseRef.current = false;
    setPaused(false);
    (async () => {
      for (let i = 0; i < 500 && run === token.current && x.alive; i++) {
        while (pauseRef.current) await sleep(80);
        x.next = [seq[i + 1], seq[i + 2]];
        setP({ ...x });
        const c = await choose(x, seq[i], seq[i + 1], seq, i);
        if (!c) {
          x.alive = false;
          setP({ ...x });
          break;
        }
        if (!(await applyChoice(x, c, seq[i], setP, run, token))) return;
        setLogs((v) =>
          [
            {
              n: i + 1,
              text: `${c.move.label} / ${c.move.chains ? c.move.chains + "連鎖" : "積み上げ"}`,
            },
            ...v,
          ].slice(0, 40),
        );
        await sleep(200);
      }
    })().catch((e) => setLogs((v) => [{ n: "ERR", text: e.message }, ...v]));
  };
  const pause = () => {
    pauseRef.current = !pauseRef.current;
    setPaused(pauseRef.current);
  };
  return (
    <>
      <section className="solo">
        <PlayerPanel p={p} set={setP} label="1P" />
        <Board p={p} label="1P" />
        <Controls {...{ seed, setSeed, start, pause, paused }} />
      </section>
      <Trace logs={logs} />
    </>
  );
}
function Battle() {
  const [seed, setSeed] = useState(4242),
    [a, setA] = useState(fresh("p1")),
    [b, setB] = useState(fresh("p2", "direct")),
    [paused, setPaused] = useState(false),
    [logs, setLogs] = useState([]),
    [result, setResult] = useState(""),
    token = useRef(0),
    pauseRef = useRef(false);
  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );
  const start = () => {
    let run = ++token.current,
      seq = createSequence(seed),
      x = fresh("p1", a.mode, a.strategy),
      y = fresh("p2", b.mode, b.strategy);
    setA({ ...x });
    setB({ ...y });
    setLogs([]);
    setResult("");
    pauseRef.current = false;
    setPaused(false);
    (async () => {
      for (let i = 0; i < 500 && run === token.current; i++) {
        while (pauseRef.current) await sleep(80);
        x.next = [seq[i + 1], seq[i + 2]];
        y.next = [seq[i + 1], seq[i + 2]];
        setA({ ...x });
        setB({ ...y });
        const [ca, cb] = await Promise.all([
          choose(x, seq[i], seq[i + 1], seq, i),
          choose(y, seq[i], seq[i + 1], seq, i),
        ]);
        if (!ca || !cb) {
          x.alive = !!ca;
          y.alive = !!cb;
          setA({ ...x });
          setB({ ...y });
          break;
        }
        await Promise.all([
          applyChoice(x, ca, seq[i], setA, run, token),
          applyChoice(y, cb, seq[i], setB, run, token),
        ]);
        if (!x.alive || !y.alive) {
          setA({ ...x });
          setB({ ...y });
          break;
        }
        let ax = Math.floor(ca.move.score / 70),
          ay = Math.floor(cb.move.score / 70),
          z = Math.min(ax, ay);
        ax -= z;
        ay -= z;
        z = Math.min(ax, x.pending);
        ax -= z;
        x.pending -= z;
        z = Math.min(ay, y.pending);
        ay -= z;
        y.pending -= z;
        for (const [q, setQ, n] of [
          [x, setA, 0],
          [y, setB, 1],
        ])
          if (q.pending) {
            const amount = Math.min(30, q.pending),
              g = dropGarbage(q.board, amount, seed + i * 2 + n);
            q.board = g.board;
            q.pending -= amount;
            q.alive = !g.overflow && !isGameOver(q.board);
          }
        x.pending += ay;
        y.pending += ax;
        setA({ ...x });
        setB({ ...y });
        setLogs((v) =>
          [
            {
              n: i + 1,
              text: `1P ${ca.move.chains}連鎖 +${Math.floor(ca.move.score / 70)}　↔　2P ${cb.move.chains}連鎖 +${Math.floor(cb.move.score / 70)}`,
            },
            ...v,
          ].slice(0, 50),
        );
        if (!x.alive || !y.alive) break;
        await sleep(240);
      }
      setResult(
        x.alive && !y.alive
          ? "1P WIN"
          : y.alive && !x.alive
            ? "2P WIN"
            : "DRAW",
      );
    })().catch((e) => setResult(e.message));
  };
  const pause = () => {
    pauseRef.current = !pauseRef.current;
    setPaused(pauseRef.current);
  };
  return (
    <>
      <div className="battle-controls">
        <Controls {...{ seed, setSeed, start, pause, paused }} />
      </div>
      <section className="battle">
        <div>
          <PlayerPanel p={a} set={setA} label="1P" />
          <Board p={a} label="1P" />
        </div>
        <div className="vs">
          <b>VS</b>
          {result && <strong>{result}</strong>}
        </div>
        <div>
          <PlayerPanel p={b} set={setB} label="2P" />
          <Board p={b} label="2P" />
        </div>
      </section>
      <Trace logs={logs} />
    </>
  );
}
export default function App() {
  const initial =
      location.pathname.includes("battle") ||
      new URLSearchParams(location.search).get("mode") === "battle"
        ? "battle"
        : "solo",
    [view, setV] = useState(initial);
  const setView = (v) => {
    history.pushState({}, "", v === "battle" ? "/battle.html" : "/");
    setV(v);
  };
  return (
    <>
      <div className="sky" />
      <main>
        <Header {...{ view, setView }} />
        {view === "solo" ? <Solo /> : <Battle />}
      </main>
    </>
  );
}
