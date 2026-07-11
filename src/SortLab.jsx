import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import {
  Sun,
  Moon,
  Github,
  Linkedin,
  Info,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Shuffle,
  X,
  ChevronDown,
  Copy,
  Check,
  Code,
} from "lucide-react";
import { CODE_SNIPPETS } from "./codeSnippets";
import { ALGORITHMS, ALGO_ORDER } from "./algorithmMetadata";
import "./SortLab.css";





/* ============================================================
   THEME TOKENS
   ============================================================ */

const DARK = {
  "--bg": "#0B0E14",
  "--panel": "#12161F",
  "--panel2": "#171C27",
  "--border": "#242A38",
  "--text": "#E7E9EE",
  "--text-muted": "#8891A3",
  "--accent": "#FFB454",
  "--accent-soft": "rgba(255,180,84,0.14)",
  "--bar-default": "#4C7FCC",
  "--bar-compare": "#F2C94C",
  "--bar-swap": "#EF476F",
  "--bar-pivot": "#9B6BFF",
  "--bar-sorted": "#31D6A0",
  "--track": "#1B2130",
};

const LIGHT = {
  "--bg": "#F3F1EC",
  "--panel": "#FFFFFF",
  "--panel2": "#FAF8F4",
  "--border": "#E1DED4",
  "--text": "#1B1F27",
  "--text-muted": "#6B7280",
  "--accent": "#C97A1E",
  "--accent-soft": "rgba(201,122,30,0.12)",
  "--bar-default": "#3E6FBF",
  "--bar-compare": "#D9A400",
  "--bar-swap": "#D53F63",
  "--bar-pivot": "#7C4FE0",
  "--bar-sorted": "#1FAE7E",
  "--track": "#ECE9E1",
};

/* ============================================================
   HELPERS
   ============================================================ */

function randomArray(size) {
  return Array.from({ length: size }, () => Math.floor(Math.random() * 96) + 4);
}

function speedToDelay(speed) {
  // speed: 1 (slow) - 100 (fast) -> ms delay
  return Math.max(4, Math.round(420 - speed * 4.1));
}

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${s}.${cs.toString().padStart(2, "0")}s`;
}

/* ============================================================
   SYNTAX HIGHLIGHTER
   ============================================================ */

const HIGHLIGHT_REGEX = /(?<preprocessor>#\s*(?:include|define|pragma)\b.*)|(?<comment>\/\/.*|#.*|\/\*[\s\S]*?\*\/)|(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(?<keyword>\b(?:const|let|var|function|return|if|else|while|for|def|class|import|from|public|private|static|void|int|double|float|char|boolean|bool|new|unsigned|template|typename|struct|using|namespace|typedef|virtual|override|elif|in|self|None|true|false|null|nullptr|std)\b)|(?<number>\b\d+(?:\.\d+)?\b)/g;

function highlightCode(code) {
  if (!code) return "";
  
  // 1. HTML-escape first
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // 2. Wrap matched groups in spans with "tok-..." class
  return escaped.replace(HIGHLIGHT_REGEX, (match, ...args) => {
    const groups = args[args.length - 1];
    if (!groups) return match;
    
    if (groups.comment) {
      return `<span class="tok-comment">${groups.comment}</span>`;
    }
    if (groups.string) {
      return `<span class="tok-string">${groups.string}</span>`;
    }
    if (groups.preprocessor) {
      return `<span class="tok-preprocessor">${groups.preprocessor}</span>`;
    }
    if (groups.keyword) {
      return `<span class="tok-keyword">${groups.keyword}</span>`;
    }
    if (groups.number) {
      return `<span class="tok-number">${groups.number}</span>`;
    }
    return match;
  });
}


/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function SortLab() {
  const [theme, setTheme] = useState("dark");
  const vars = theme === "dark" ? DARK : LIGHT;

  const toggleTheme = (e) => {
    const next = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    if (!document.startViewTransition) {
      next();
      return;
    }

    if (e && e.clientX !== undefined && e.clientY !== undefined) {
      document.documentElement.style.setProperty("--clip-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--clip-y", `${e.clientY}px`);
    } else {
      document.documentElement.style.setProperty("--clip-x", "50%");
      document.documentElement.style.setProperty("--clip-y", "50%");
    }

    document.startViewTransition(() => {
      flushSync(next);
    });
  };

  const [algoKey, setAlgoKey] = useState("bubble");
  const [arraySize, setArraySize] = useState(32);
  const [speed, setSpeed] = useState(55);
  const [array, setArray] = useState(() => randomArray(32));
  const [bases, setBases] = useState(() => new Array(32).fill("default"));
  const [transients, setTransients] = useState(() => new Array(32).fill(null));

  const [stats, setStats] = useState({
    comparisons: 0,
    swaps: 0,
    accesses: 0,
    iteration: 0,
    elapsedMs: 0,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [customError, setCustomError] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [algoMenuOpen, setAlgoMenuOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [copied, setCopied] = useState(false);

  const genRef = useRef(null);
  const workArrRef = useRef([]);
  const intervalRef = useRef(null);
  const clockRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedAccumRef = useRef(0);
  const sweepTimeoutsRef = useRef([]);
  const dropdownRef = useRef(null);
  const codeViewerRef = useRef(null);

  const algo = ALGORITHMS[algoKey];
  const locked = isRunning || isPaused;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAlgoMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const clearSweeps = () => {
    sweepTimeoutsRef.current.forEach((t) => clearTimeout(t));
    sweepTimeoutsRef.current = [];
  };

  const stopClock = () => {
    if (clockRef.current) {
      clearInterval(clockRef.current);
      clockRef.current = null;
    }
  };

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const hardReset = useCallback(
    (newArray) => {
      stopInterval();
      stopClock();
      clearSweeps();
      genRef.current = null;
      workArrRef.current = [...newArray];
      pausedAccumRef.current = 0;
      setArray(newArray);
      setBases(new Array(newArray.length).fill("default"));
      setTransients(new Array(newArray.length).fill(null));
      setStats({ comparisons: 0, swaps: 0, accesses: 0, iteration: 0, elapsedMs: 0 });
      setIsRunning(false);
      setIsPaused(false);
      setIsFinished(false);
    },
    []
  );

  const handleGenerateRandom = () => {
    hardReset(randomArray(arraySize));
  };

  const handleSizeChange = (n) => {
    setArraySize(n);
    hardReset(randomArray(n));
  };

  const copyTimeoutRef = useRef(null);

  const handleCopyCode = async () => {
    const rawCode = CODE_SNIPPETS[algoKey]?.[selectedLanguage] || "";
    
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }

    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 1500);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  const scrollToCode = () => {
    if (codeViewerRef.current) {
      codeViewerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const applyCustomArray = () => {
    const parts = customValue
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length < 2) {
      setCustomError("Enter at least 2 comma-separated numbers.");
      return;
    }
    const nums = parts.map(Number);
    if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 999)) {
      setCustomError("Values must be numbers between 0 and 999.");
      return;
    }
    setCustomError("");
    setArraySize(nums.length);
    hardReset(nums);
    setShowCustom(false);
  };

  const runSortedSweep = useCallback((finalArrLen) => {
    setTransients(new Array(finalArrLen).fill(null));
    for (let i = 0; i < finalArrLen; i++) {
      const t = setTimeout(() => {
        setBases((prev) => {
          if (prev[i] === "sorted") return prev;
          const next = [...prev];
          next[i] = "sorted";
          return next;
        });
      }, i * 8);
      sweepTimeoutsRef.current.push(t);
    }
    const finishTimeout = setTimeout(() => {
      setIsRunning(false);
      setIsPaused(false);
      setIsFinished(true);
      stopClock();
    }, finalArrLen * 8 + 30);
    sweepTimeoutsRef.current.push(finishTimeout);
  }, []);

  const processStep = useCallback(
    (step) => {
      setTransients(new Array(workArrRef.current.length).fill(null));

      setStats((prev) => {
        const next = { ...prev, iteration: prev.iteration + 1 };
        if (step.type === "compare") {
          next.comparisons += 1;
          next.accesses += 2;
        } else if (step.type === "swap") {
          next.swaps += 1;
          next.accesses += 2;
        } else if (step.type === "overwrite") {
          next.accesses += 1;
        } else if (step.type === "access") {
          next.accesses += 1;
        }
        return next;
      });

      if (step.type === "compare") {
        const [i, j] = step.indices;
        setTransients((prev) => {
          const next = [...prev];
          next[i] = "comparing";
          next[j] = "comparing";
          return next;
        });
      } else if (step.type === "swap") {
        const [i, j] = step.indices;
        [workArrRef.current[i], workArrRef.current[j]] = [
          workArrRef.current[j],
          workArrRef.current[i],
        ];
        setArray([...workArrRef.current]);
        setTransients((prev) => {
          const next = [...prev];
          next[i] = "swapping";
          next[j] = "swapping";
          return next;
        });
      } else if (step.type === "overwrite") {
        workArrRef.current[step.index] = step.value;
        setArray([...workArrRef.current]);
        setTransients((prev) => {
          const next = [...prev];
          next[step.index] = "comparing";
          return next;
        });
      } else if (step.type === "access") {
        setTransients((prev) => {
          const next = [...prev];
          next[step.index] = "comparing";
          return next;
        });
      } else if (step.type === "pivot") {
        setBases((prev) => {
          const next = [...prev];
          next[step.index] = "pivot";
          return next;
        });
      } else if (step.type === "sorted") {
        setBases((prev) => {
          const next = [...prev];
          next[step.index] = "sorted";
          return next;
        });
      }
    },
    []
  );

  const tick = useCallback(() => {
    if (!genRef.current) return;
    const { value, done } = genRef.current.next();
    if (done) {
      stopInterval();
      runSortedSweep(workArrRef.current.length);
      return;
    }
    processStep(value);
  }, [processStep, runSortedSweep]);

  const ensureGenerator = () => {
    if (!genRef.current) {
      workArrRef.current = [...array];
      genRef.current = algo.gen(workArrRef.current);
    }
  };

  const handleStart = () => {
    if (isFinished) return;
    ensureGenerator();
    setIsRunning(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();
    stopClock();
    clockRef.current = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        elapsedMs: pausedAccumRef.current + (Date.now() - startTimeRef.current),
      }));
    }, 90);
    stopInterval();
    intervalRef.current = setInterval(tick, speedToDelay(speed));
  };

  const handlePause = () => {
    stopInterval();
    stopClock();
    pausedAccumRef.current += Date.now() - startTimeRef.current;
    setIsRunning(false);
    setIsPaused(true);
  };

  const handleResume = () => {
    ensureGenerator();
    setIsRunning(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();
    stopClock();
    clockRef.current = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        elapsedMs: pausedAccumRef.current + (Date.now() - startTimeRef.current),
      }));
    }, 90);
    stopInterval();
    intervalRef.current = setInterval(tick, speedToDelay(speed));
  };

  const handleStep = () => {
    if (isFinished) return;
    stopInterval();
    setIsRunning(false);
    setIsPaused(true);
    ensureGenerator();
    tick();
  };

  const handleReset = () => {
    hardReset(randomArray(arraySize));
  };

  // Live-adjust interval speed while running
  useEffect(() => {
    if (isRunning && intervalRef.current) {
      stopInterval();
      intervalRef.current = setInterval(tick, speedToDelay(speed));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  useEffect(() => {
    return () => {
      stopInterval();
      stopClock();
      clearSweeps();
    };
  }, []);

  const maxVal = useMemo(() => Math.max(...array, 1), [array]);

  const colorFor = (i) => {
    const key = transients[i] || bases[i] || "default";
    switch (key) {
      case "comparing":
        return "var(--bar-compare)";
      case "swapping":
        return "var(--bar-swap)";
      case "pivot":
        return "var(--bar-pivot)";
      case "sorted":
        return "var(--bar-sorted)";
      default:
        return "var(--bar-default)";
    }
  };

  const complexityRows = ALGO_ORDER.map((key) => ({ key, ...ALGORITHMS[key] }));

  return (
    <div className="sl-root" style={vars}>
      {/* HEADER */}
      <header className="sl-header">
        <div className="sl-logo">
          <div>
            <div className="sl-title sl-display">SortLab</div>
            <div className="sl-subtitle">an interactive sorting algorithm workbench</div>
          </div>
        </div>
        <div className="sl-header-actions">
          <button className="sl-iconbtn" onClick={toggleTheme} title="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <a className="sl-iconbtn" href="https://github.com/NiranjanS8/sorting-algorithm-visualizer" target="_blank" rel="noreferrer" title="GitHub repository">
            <Github size={16} />
          </a>
          <button className="sl-textbtn" onClick={() => setAboutOpen(true)}>
            <Info size={15} /> About
          </button>
        </div>
      </header>

      <div className="sl-main">
        {/* CONTROL PANEL */}
        <div className="sl-panel sl-controls">
          <div className="sl-field">
            <span className="sl-label">Algorithm</span>
            <div className="sl-select-wrap" ref={dropdownRef}>
              <button
                className="sl-dropdown-trigger"
                disabled={locked}
                onClick={() => setAlgoMenuOpen((v) => !v)}
              >
                <span>{algo.label}</span>
                <ChevronDown size={15} className={`sl-dropdown-chevron${algoMenuOpen ? " open" : ""}`} />
              </button>
              {algoMenuOpen && (
                <div className="sl-dropdown-menu">
                  {ALGO_ORDER.map((k) => (
                    <button
                      key={k}
                      className={`sl-dropdown-item${k === algoKey ? " active" : ""}`}
                      onClick={() => {
                        setAlgoKey(k);
                        hardReset(array);
                        setAlgoMenuOpen(false);
                      }}
                    >
                      {ALGORITHMS[k].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="sl-field" style={{ minWidth: 180 }}>
            <div className="sl-slider-row">
              <div className="sl-slider-head">
                <span className="sl-label">Array Size</span>
                <span className="sl-slider-badge">{arraySize}</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={arraySize}
                disabled={locked}
                className="sl-slider"
                style={{ background: `linear-gradient(to right, var(--accent) ${((arraySize - 5) / 95) * 100}%, var(--track) ${((arraySize - 5) / 95) * 100}%)` }}
                onChange={(e) => handleSizeChange(Number(e.target.value))}
              />
              <div className="sl-slider-endpoints">
                <span>5</span>
                <span>100</span>
              </div>
            </div>
          </div>

          <div className="sl-field" style={{ minWidth: 180 }}>
            <div className="sl-slider-row">
              <div className="sl-slider-head">
                <span className="sl-label">Speed</span>
                <span className="sl-slider-badge">{speed}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={speed}
                className="sl-slider"
                style={{ background: `linear-gradient(to right, var(--accent) ${((speed - 1) / 99) * 100}%, var(--track) ${((speed - 1) / 99) * 100}%)` }}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <div className="sl-slider-endpoints">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>
          </div>

          <div className="sl-field">
            <span className="sl-label">Data</span>
            <div className="sl-btn-group">
              <button className="sl-btn" disabled={locked} onClick={handleGenerateRandom}>
                <Shuffle size={14} /> Random
              </button>
              <button className="sl-btn" disabled={locked} onClick={() => setShowCustom(true)}>
                Custom&hellip;
              </button>
            </div>
          </div>

          <div className="sl-field" style={{ marginLeft: "auto" }}>
            <span className="sl-label">Playback</span>
            <div className="sl-btn-group">
              {!isRunning ? (
                <button className="sl-btn sl-btn-primary" disabled={isFinished} onClick={isPaused ? handleResume : handleStart}>
                  <Play size={14} /> {isPaused ? "Resume" : "Start"}
                </button>
              ) : (
                <button className="sl-btn sl-btn-primary" onClick={handlePause}>
                  <Pause size={14} /> Pause
                </button>
              )}
              <button className="sl-btn" disabled={isRunning || isFinished} onClick={handleStep}>
                <SkipForward size={14} /> Step
              </button>
              <button className="sl-btn" onClick={handleReset}>
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT GRID */}
        <div className="sl-content-grid">
          {/* VISUALIZATION */}
          <div className="sl-panel sl-viz-card">
            <div className="sl-viz-frame">
              {array.map((val, i) => (
                <div
                  key={i}
                  className="sl-bar"
                  style={{
                    height: `${(val / maxVal) * 100}%`,
                    backgroundColor: colorFor(i),
                    boxShadow:
                      transients[i] || bases[i] === "pivot"
                        ? `0 0 10px ${colorFor(i)}`
                        : "none",
                  }}
                  title={`${val}`}
                >
                  {arraySize <= 25 && (
                    <span className="sl-bar-value">{val}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="sl-legend">
              <span className="sl-legend-item">
                <span className="sl-legend-dot" style={{ background: "var(--bar-default)" }} /> Default
              </span>
              <span className="sl-legend-item">
                <span className="sl-legend-dot" style={{ background: "var(--bar-compare)" }} /> Comparing
              </span>
              <span className="sl-legend-item">
                <span className="sl-legend-dot" style={{ background: "var(--bar-swap)" }} /> Swapping
              </span>
              <span className="sl-legend-item">
                <span className="sl-legend-dot" style={{ background: "var(--bar-pivot)" }} /> Pivot
              </span>
              <span className="sl-legend-item">
                <span className="sl-legend-dot" style={{ background: "var(--bar-sorted)" }} /> Sorted
              </span>
            </div>

            <div className="sl-stats-strip sl-mono">
              <div className="sl-stat">
                <div className="sl-stat-label">Comparisons</div>
                <div className="sl-stat-val">{stats.comparisons}</div>
              </div>
              <div className="sl-stat">
                <div className="sl-stat-label">Swaps</div>
                <div className="sl-stat-val">{stats.swaps}</div>
              </div>
              <div className="sl-stat">
                <div className="sl-stat-label">Array Accesses</div>
                <div className="sl-stat-val">{stats.accesses}</div>
              </div>
              <div className="sl-stat">
                <div className="sl-stat-label">Iteration</div>
                <div className="sl-stat-val">{stats.iteration}</div>
              </div>
              <div className="sl-stat">
                <div className="sl-stat-label">Elapsed</div>
                <div className="sl-stat-val">{formatMs(stats.elapsedMs)}</div>
              </div>
              <div className="sl-stat">
                <div className="sl-stat-label">Speed</div>
                <div className="sl-stat-val">{speed}%</div>
              </div>
            </div>
          </div>

          {/* ALGORITHM INFO */}
          <div className="sl-panel sl-info-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div className="sl-info-title sl-display">{algo.label}</div>
                <p className="sl-info-desc" style={{ marginTop: 8 }}>{algo.description}</p>
              </div>
              <button 
                className="sl-code-btn" 
                onClick={scrollToCode} 
                style={{ flexShrink: 0, padding: "6px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Code size={13} />
                View Code
              </button>
            </div>

            <div className="sl-badges">
              <span className="sl-badge">{algo.stable ? "Stable" : "Unstable"}</span>
              <span className="sl-badge">{algo.inPlace ? "In-place" : "Not in-place"}</span>
            </div>

            <div>
              <div className="sl-info-section-title">Working Principle</div>
              <p className="sl-info-desc">{algo.principle}</p>
            </div>

            <div>
              <div className="sl-info-section-title">Advantages</div>
              <ul className="sl-info-list">
                {algo.advantages.map((a, idx) => <li key={idx}>{a}</li>)}
              </ul>
            </div>

            <div>
              <div className="sl-info-section-title">Disadvantages</div>
              <ul className="sl-info-list">
                {algo.disadvantages.map((a, idx) => <li key={idx}>{a}</li>)}
              </ul>
            </div>

            <div>
              <div className="sl-info-section-title">Complexity</div>
              <div className="sl-complexity-grid">
                <div className="sl-complexity-cell"><div className="k">Best</div><div className="v">{algo.complexity.best}</div></div>
                <div className="sl-complexity-cell"><div className="k">Average</div><div className="v">{algo.complexity.avg}</div></div>
                <div className="sl-complexity-cell"><div className="k">Worst</div><div className="v">{algo.complexity.worst}</div></div>
                <div className="sl-complexity-cell"><div className="k">Space</div><div className="v">{algo.complexity.space}</div></div>
              </div>
            </div>

            <div>
              <div className="sl-info-section-title">Typical Use Cases</div>
              <p className="sl-info-desc">{algo.useCases}</p>
            </div>
          </div>
        </div>

        {/* COMPLEXITY TABLE */}
        <div className="sl-panel sl-table-card">
          <div className="sl-info-section-title" style={{ marginBottom: 10 }}>Complexity Reference</div>
          <table className="sl-table">
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>Best</th>
                <th>Average</th>
                <th>Worst</th>
                <th>Space</th>
                <th>Stable</th>
                <th>In-place</th>
              </tr>
            </thead>
            <tbody>
              {complexityRows.map((row) => (
                <tr key={row.key} className={row.key === algoKey ? "active-row" : ""}>
                  <td>{row.label}</td>
                  <td className="mono">{row.complexity.best}</td>
                  <td className="mono">{row.complexity.avg}</td>
                  <td className="mono">{row.complexity.worst}</td>
                  <td className="mono">{row.complexity.space}</td>
                  <td>{row.stable ? "\u2705" : "\u274C"}</td>
                  <td>{row.inPlace ? "\u2705" : "\u274C"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CODE VIEWER */}
        <div ref={codeViewerRef} className="sl-panel sl-code-card">
          <div className="sl-code-header">
            <div>
              <div className="sl-info-section-title" style={{ marginBottom: 4, fontSize: 11, letterSpacing: "0.08em", fontWeight: 700 }}>CODE VIEWER</div>
              <div className="sl-info-title sl-display" style={{ fontSize: 16, color: "var(--text-muted)" }}>
                {algo.label} implementation
              </div>
            </div>
            <div className="sl-code-actions">
              {[
                { id: "javascript", label: "JavaScript" },
                { id: "python", label: "Python" },
                { id: "java", label: "Java" },
                { id: "cpp", label: "C++" },
                { id: "c", label: "C" },
              ].map((lang) => (
                <button
                  key={lang.id}
                  className={`sl-code-btn${selectedLanguage === lang.id ? " active" : ""}`}
                  onClick={() => setSelectedLanguage(lang.id)}
                >
                  {lang.label}
                </button>
              ))}
              
              <button className="sl-code-btn sl-copy-btn" onClick={handleCopyCode} style={{ marginLeft: 4 }}>
                {copied ? <Check size={14} className="sl-bar-sorted" style={{ color: "var(--bar-sorted)", marginRight: 6 }} /> : <Copy size={14} style={{ marginRight: 6 }} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
          <div className="sl-code-pre-container">
            <pre className="sl-code-pre">
              <code dangerouslySetInnerHTML={{ __html: highlightCode(CODE_SNIPPETS[algoKey]?.[selectedLanguage] || "") }} />
            </pre>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="sl-footer">
        <div style={{ display: "flex", gap: 16 }}>
          <a href="https://github.com/NiranjanS8/sorting-algorithm-visualizer" target="_blank" rel="noreferrer">GitHub Repository</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>Built by Niranjan</span>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="https://github.com/NiranjanS8/" target="_blank" rel="noreferrer" title="GitHub Profile" style={{ display: "inline-flex", alignItems: "center" }}>
              <Github size={14} />
            </a>
            <a href="https://www.linkedin.com/in/niranjans8" target="_blank" rel="noreferrer" title="LinkedIn Profile" style={{ display: "inline-flex", alignItems: "center" }}>
              <Linkedin size={14} />
            </a>
          </div>
        </div>
      </footer>

      {/* CUSTOM ARRAY MODAL */}
      {showCustom && (
        <div className="sl-modal-overlay" onClick={() => setShowCustom(false)}>
          <div className="sl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sl-modal-head">
              <div className="sl-info-title sl-display">Custom Array</div>
              <button className="sl-iconbtn" onClick={() => setShowCustom(false)}><X size={16} /></button>
            </div>
            <div className="sl-custom-box" style={{ padding: 0 }}>
              <span className="sl-info-desc">Enter comma-separated whole numbers (0&ndash;999).</span>
              <input
                className="sl-input"
                placeholder="e.g. 24, 7, 88, 3, 51, 12"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
              />
              {customError && <span className="sl-error">{customError}</span>}
              <button className="sl-btn sl-btn-primary" onClick={applyCustomArray}>Apply Array</button>
            </div>
          </div>
        </div>
      )}

      {/* ABOUT MODAL */}
      {aboutOpen && (
        <div className="sl-modal-overlay" onClick={() => setAboutOpen(false)}>
          <div className="sl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sl-modal-head">
              <div className="sl-info-title sl-display">About SortLab</div>
              <button className="sl-iconbtn" onClick={() => setAboutOpen(false)}><X size={16} /></button>
            </div>
            <p className="sl-info-desc">
              SortLab is an interactive workbench for learning, comparing, and experimenting with
              classic sorting algorithms. Every algorithm runs as a step generator, so you can play,
              pause, resume, or step through the exact sequence of comparisons and swaps at any speed.
            </p>
            <p className="sl-info-desc" style={{ marginTop: 10 }}>
              Nine algorithms are included: Bubble, Selection, Insertion, Merge, Quick, Heap, Shell,
              Counting, and Radix Sort, each paired with a plain-language explanation of how and when
              to use it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
