import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import {
  Sun,
  Moon,
  Github,
  Info,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Shuffle,
  X,
  ChevronDown,
} from "lucide-react";

/* ============================================================
   SORTING GENERATORS
   Each generator yields step objects describing one atomic
   operation so the player can animate / pause / step through
   them one at a time:
     { type: 'compare',  indices:[i,j] }
     { type: 'swap',     indices:[i,j] }
     { type: 'overwrite',index:i, value:v }
     { type: 'access',   index:i }
     { type: 'pivot',    index:i }
     { type: 'sorted',   index:i }
   ============================================================ */

function* bubbleSortGen(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      yield { type: "compare", indices: [j, j + 1] };
      if (arr[j] > arr[j + 1]) {
        yield { type: "swap", indices: [j, j + 1] };
        swapped = true;
      }
    }
    yield { type: "sorted", index: n - 1 - i };
    if (!swapped) break;
  }
}

function* selectionSortGen(arr) {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    let min = i;
    for (let j = i + 1; j < n; j++) {
      yield { type: "compare", indices: [j, min] };
      if (arr[j] < arr[min]) min = j;
    }
    if (min !== i) {
      yield { type: "swap", indices: [i, min] };
    }
    yield { type: "sorted", index: i };
  }
}

function* insertionSortGen(arr) {
  const n = arr.length;
  yield { type: "sorted", index: 0 };
  for (let i = 1; i < n; i++) {
    let j = i;
    while (j > 0) {
      yield { type: "compare", indices: [j - 1, j] };
      if (arr[j - 1] > arr[j]) {
        yield { type: "swap", indices: [j - 1, j] };
        j--;
      } else break;
    }
    yield { type: "sorted", index: i };
  }
}

function* mergeGen(arr, lo, mid, hi) {
  const left = arr.slice(lo, mid + 1);
  const right = arr.slice(mid + 1, hi + 1);
  let i = 0,
    j = 0,
    k = lo;
  while (i < left.length && j < right.length) {
    yield { type: "compare", indices: [lo + i, mid + 1 + j] };
    if (left[i] <= right[j]) {
      yield { type: "overwrite", index: k, value: left[i] };
      i++;
    } else {
      yield { type: "overwrite", index: k, value: right[j] };
      j++;
    }
    k++;
  }
  while (i < left.length) {
    yield { type: "overwrite", index: k, value: left[i] };
    i++;
    k++;
  }
  while (j < right.length) {
    yield { type: "overwrite", index: k, value: right[j] };
    j++;
    k++;
  }
}
function* mergeSortGen(arr, lo = 0, hi = arr.length - 1) {
  if (lo >= hi) return;
  const mid = Math.floor((lo + hi) / 2);
  yield* mergeSortGen(arr, lo, mid);
  yield* mergeSortGen(arr, mid + 1, hi);
  yield* mergeGen(arr, lo, mid, hi);
}

function* partitionGen(arr, lo, hi) {
  const pivot = arr[hi];
  yield { type: "pivot", index: hi };
  let i = lo - 1;
  for (let j = lo; j < hi; j++) {
    yield { type: "compare", indices: [j, hi] };
    if (arr[j] < pivot) {
      i++;
      if (i !== j) {
        yield { type: "swap", indices: [i, j] };
      }
    }
  }
  yield { type: "swap", indices: [i + 1, hi] };
  return i + 1;
}
function* quickSortGen(arr, lo = 0, hi = arr.length - 1) {
  if (lo < hi) {
    const p = yield* partitionGen(arr, lo, hi);
    yield* quickSortGen(arr, lo, p - 1);
    yield* quickSortGen(arr, p + 1, hi);
  }
}

function* heapifyGen(arr, n, i) {
  let largest = i;
  const l = 2 * i + 1,
    r = 2 * i + 2;
  if (l < n) {
    yield { type: "compare", indices: [l, largest] };
    if (arr[l] > arr[largest]) largest = l;
  }
  if (r < n) {
    yield { type: "compare", indices: [r, largest] };
    if (arr[r] > arr[largest]) largest = r;
  }
  if (largest !== i) {
    yield { type: "swap", indices: [i, largest] };
    yield* heapifyGen(arr, n, largest);
  }
}
function* heapSortGen(arr) {
  const n = arr.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) yield* heapifyGen(arr, n, i);
  for (let i = n - 1; i > 0; i--) {
    yield { type: "swap", indices: [0, i] };
    yield* heapifyGen(arr, i, 0);
  }
}

function* shellSortGen(arr) {
  const n = arr.length;
  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    for (let i = gap; i < n; i++) {
      let j = i;
      while (j >= gap) {
        yield { type: "compare", indices: [j - gap, j] };
        if (arr[j - gap] > arr[j]) {
          yield { type: "swap", indices: [j - gap, j] };
          j -= gap;
        } else break;
      }
    }
  }
}

function* countingSortGen(arr) {
  const n = arr.length;
  const max = Math.max(...arr);
  const count = new Array(max + 1).fill(0);
  for (let i = 0; i < n; i++) {
    yield { type: "access", index: i };
    count[arr[i]]++;
  }
  for (let i = 1; i <= max; i++) count[i] += count[i - 1];
  const output = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    yield { type: "access", index: i };
    output[count[arr[i]] - 1] = arr[i];
    count[arr[i]]--;
  }
  for (let i = 0; i < n; i++) {
    yield { type: "overwrite", index: i, value: output[i] };
  }
}

function* radixSortGen(arr) {
  const n = arr.length;
  const max = Math.max(...arr);
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    const output = new Array(n).fill(0);
    const count = new Array(10).fill(0);
    for (let i = 0; i < n; i++) {
      yield { type: "access", index: i };
      count[Math.floor(arr[i] / exp) % 10]++;
    }
    for (let i = 1; i < 10; i++) count[i] += count[i - 1];
    for (let i = n - 1; i >= 0; i--) {
      const digit = Math.floor(arr[i] / exp) % 10;
      yield { type: "access", index: i };
      output[count[digit] - 1] = arr[i];
      count[digit]--;
    }
    for (let i = 0; i < n; i++) {
      yield { type: "overwrite", index: i, value: output[i] };
    }
  }
}

/* ============================================================
   ALGORITHM METADATA
   ============================================================ */

const ALGORITHMS = {
  bubble: {
    label: "Bubble Sort",
    gen: bubbleSortGen,
    complexity: { best: "O(n)", avg: "O(n\u00B2)", worst: "O(n\u00B2)", space: "O(1)" },
    stable: true,
    inPlace: true,
    description:
      "Repeatedly steps through the array, comparing adjacent elements and swapping them if they're in the wrong order.",
    principle:
      "Each full pass pushes the largest remaining element to its final position at the end, like a bubble rising to the surface. A pass with no swaps means the array is already sorted.",
    advantages: [
      "Extremely simple to understand and implement",
      "No extra memory required",
      "Can detect an already-sorted array early",
    ],
    disadvantages: [
      "Very slow on large inputs",
      "O(n\u00B2) comparisons even in the average case",
    ],
    useCases: "Teaching sorting concepts; tiny or nearly-sorted datasets.",
  },
  selection: {
    label: "Selection Sort",
    gen: selectionSortGen,
    complexity: { best: "O(n\u00B2)", avg: "O(n\u00B2)", worst: "O(n\u00B2)", space: "O(1)" },
    stable: false,
    inPlace: true,
    description:
      "Finds the minimum element in the unsorted portion of the array and swaps it into place at the front.",
    principle:
      "The array is divided into a sorted prefix and an unsorted suffix. Each iteration scans the suffix once for its minimum, then extends the sorted prefix by one.",
    advantages: [
      "Performs at most n swaps, useful when writes are costly",
      "Simple, predictable control flow",
    ],
    disadvantages: [
      "Always O(n\u00B2) comparisons, regardless of input order",
      "Not stable in its standard form",
    ],
    useCases: "Situations where memory writes are expensive relative to comparisons.",
  },
  insertion: {
    label: "Insertion Sort",
    gen: insertionSortGen,
    complexity: { best: "O(n)", avg: "O(n\u00B2)", worst: "O(n\u00B2)", space: "O(1)" },
    stable: true,
    inPlace: true,
    description:
      "Builds the sorted array one element at a time by shifting larger elements to make room for each new value.",
    principle:
      "Treats the array as a sorted left portion and an unsorted right portion, taking the next element and inserting it into its correct position among the sorted elements.",
    advantages: [
      "Very efficient on small or nearly-sorted data",
      "Stable, in-place, and adaptive",
      "Online: can sort data as it arrives",
    ],
    disadvantages: [
      "O(n\u00B2) worst case",
      "Inefficient for large, randomly-ordered datasets",
    ],
    useCases: "Small arrays; nearly-sorted data; used as the base case inside hybrid sorts like Timsort.",
  },
  merge: {
    label: "Merge Sort",
    gen: mergeSortGen,
    complexity: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(n)" },
    stable: true,
    inPlace: false,
    description:
      "A divide-and-conquer algorithm that splits the array in half recursively, then merges the sorted halves back together.",
    principle:
      "Recursively divide until each sub-array has one element, then merge pairs of sorted sub-arrays by repeatedly taking the smaller front element.",
    advantages: [
      "Guaranteed O(n log n), regardless of input order",
      "Stable, and well suited to linked lists and external sorting",
    ],
    disadvantages: [
      "Requires O(n) extra space",
      "Higher constant factor overhead than quicksort in practice",
    ],
    useCases: "External sorting, sorting linked lists, or any case where stability is required.",
  },
  quick: {
    label: "Quick Sort",
    gen: quickSortGen,
    complexity: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n\u00B2)", space: "O(log n)" },
    stable: false,
    inPlace: true,
    description:
      "Picks a pivot element and partitions the array so smaller elements go left of the pivot and larger ones go right, then recurses on each side.",
    principle:
      "Partitioning places the pivot at its final sorted position in one pass; recursively applying this to each partition eventually sorts the whole array.",
    advantages: [
      "Very fast in practice with good cache locality",
      "In-place, low memory overhead",
    ],
    disadvantages: [
      "O(n\u00B2) worst case on poor pivot choices",
      "Not stable; recursion depth can be a concern on adversarial input",
    ],
    useCases: "General-purpose default sort in many standard libraries (with randomized or median-of-three pivots).",
  },
  heap: {
    label: "Heap Sort",
    gen: heapSortGen,
    complexity: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(1)" },
    stable: false,
    inPlace: true,
    description:
      "Builds a max-heap from the array, then repeatedly extracts the maximum element and moves it to the end.",
    principle:
      "A binary heap keeps the largest element at the root. Swapping the root with the last unsorted element and re-heapifying repeatedly yields a sorted array.",
    advantages: [
      "Guaranteed O(n log n) with no extra memory",
      "In-place with predictable worst-case performance",
    ],
    disadvantages: [
      "Not stable",
      "Poorer cache locality than quicksort, usually slower in practice",
    ],
    useCases: "Memory-constrained systems that need a guaranteed worst-case bound.",
  },
  shell: {
    label: "Shell Sort",
    gen: shellSortGen,
    complexity: { best: "O(n log n)", avg: "O(n\u00B9\u00B7\u00B3)", worst: "O(n\u00B2)", space: "O(1)" },
    stable: false,
    inPlace: true,
    description:
      "A generalization of insertion sort that compares elements far apart using a shrinking gap sequence, moving elements closer to their final position early.",
    principle:
      "Start with a large gap and insertion-sort elements that gap apart, then shrink the gap until it reaches 1, at which point a final pass finishes the sort.",
    advantages: [
      "Noticeably better than insertion sort on medium-sized arrays",
      "In-place, no extra memory",
    ],
    disadvantages: [
      "Performance depends heavily on the chosen gap sequence",
      "Not stable; harder to analyze precisely",
    ],
    useCases: "Medium-sized arrays and embedded systems with tight memory budgets.",
  },
  counting: {
    label: "Counting Sort",
    gen: countingSortGen,
    complexity: { best: "O(n+k)", avg: "O(n+k)", worst: "O(n+k)", space: "O(n+k)" },
    stable: true,
    inPlace: false,
    description:
      "Counts occurrences of each distinct value, then uses prefix sums to place every element directly into its sorted position.",
    principle:
      "No comparisons at all: a count array tallies each key's frequency, prefix sums convert those into positions, and elements are placed accordingly.",
    advantages: [
      "Linear time O(n+k)",
      "Stable and comparison-free",
    ],
    disadvantages: [
      "Requires known, bounded integer keys",
      "Wasteful in memory when the key range k is much larger than n",
    ],
    useCases: "Sorting integers or small-range keys; used as a subroutine inside radix sort.",
  },
  radix: {
    label: "Radix Sort",
    gen: radixSortGen,
    complexity: { best: "O(d(n+b))", avg: "O(d(n+b))", worst: "O(d(n+b))", space: "O(n+b)" },
    stable: true,
    inPlace: false,
    description:
      "Sorts integers digit by digit, from least to most significant, using a stable counting sort at each digit position.",
    principle:
      "Because the underlying per-digit sort is stable, sorting from the least significant digit up to the most significant digit leaves the whole array correctly ordered.",
    advantages: [
      "Linear time for a fixed number of digits d",
      "Stable",
    ],
    disadvantages: [
      "Only works on integers or fixed-format keys",
      "Extra memory; performance depends on digit count and base",
    ],
    useCases: "Sorting large sets of integers or fixed-length strings with a bounded number of digits.",
  },
};

const ALGO_ORDER = [
  "bubble",
  "selection",
  "insertion",
  "merge",
  "quick",
  "heap",
  "shell",
  "counting",
  "radix",
];

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

  const genRef = useRef(null);
  const workArrRef = useRef([]);
  const intervalRef = useRef(null);
  const clockRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedAccumRef = useRef(0);
  const sweepTimeoutsRef = useRef([]);
  const dropdownRef = useRef(null);

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
      <style>{`
        .sl-root {
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', sans-serif;
          min-height: 100%;
          width: 100%;
          transition: background 0.25s ease, color 0.25s ease;
        }
        .sl-mono { font-family: 'JetBrains Mono', monospace; }
        .sl-display { font-family: 'Space Grotesk', sans-serif; }

        .sl-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 22px;
          border-bottom: 1px solid var(--border);
          background: var(--panel);
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .sl-logo {
          display: flex; align-items: center; gap: 10px;
        }
        .sl-logo-mark {
          width: 30px; height: 30px; border-radius: 7px;
          background: linear-gradient(160deg, var(--accent), transparent);
          display: flex; align-items: flex-end; justify-content: center; gap: 2px;
          padding: 5px;
          box-shadow: 0 0 0 1px var(--border) inset;
        }
        .sl-logo-mark span {
          width: 3px; background: var(--bg); border-radius: 1px;
        }
        .sl-title {
          font-weight: 700; font-size: 17px; letter-spacing: -0.01em;
        }
        .sl-subtitle {
          font-size: 11px; color: var(--text-muted); margin-top: -2px;
        }
        .sl-header-actions { display: flex; align-items: center; gap: 8px; }
        .sl-iconbtn {
          width: 34px; height: 34px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          background: var(--panel2); border: 1px solid var(--border);
          color: var(--text); cursor: pointer;
          transition: border-color 0.15s ease;
        }
        .sl-iconbtn:hover { border-color: var(--accent); }
        .sl-textbtn {
          height: 34px; padding: 0 12px; border-radius: 8px;
          display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500;
          background: var(--panel2); border: 1px solid var(--border);
          color: var(--text); cursor: pointer;
        }
        .sl-textbtn:hover { border-color: var(--accent); }

        .sl-main {
          max-width: 1320px; margin: 0 auto; padding: 20px 22px 60px;
          display: flex; flex-direction: column; gap: 18px;
        }

        .sl-panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
        }

        .sl-controls {
          display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px;
          padding: 16px 18px;
        }
        .sl-field { display: flex; flex-direction: column; gap: 6px; min-width: 150px; }
        .sl-label {
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--text-muted); font-weight: 600;
        }
        .sl-select-wrap { position: relative; }
        .sl-dropdown-trigger {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; height: 36px; padding: 0 10px 0 12px;
          border-radius: 8px; border: 1px solid var(--border); background: var(--panel2);
          color: var(--text); font-size: 13px; font-weight: 500; cursor: pointer;
          transition: border-color 0.15s ease;
        }
        .sl-dropdown-trigger:hover { border-color: var(--accent); }
        .sl-dropdown-trigger:disabled { opacity: 0.4; cursor: not-allowed; }
        .sl-dropdown-trigger:disabled:hover { border-color: var(--border); }
        .sl-dropdown-chevron {
          color: var(--text-muted); transition: transform 0.2s ease;
        }
        .sl-dropdown-chevron.open { transform: rotate(180deg); }
        .sl-dropdown-menu {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 8px; padding: 4px 0; z-index: 30;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
          max-height: 280px; overflow-y: auto;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .sl-dropdown-menu::-webkit-scrollbar { display: none; }
        .sl-dropdown-item {
          display: block; width: 100%; padding: 8px 12px;
          font-size: 13px; font-weight: 500; text-align: left;
          background: none; border: none; color: var(--text);
          cursor: pointer; transition: background 0.1s ease;
        }
        .sl-dropdown-item:hover { background: var(--panel2); }
        .sl-dropdown-item.active {
          background: var(--accent); color: var(--bg); font-weight: 600;
        }
        .sl-slider-row { display: flex; flex-direction: column; gap: 0; width: 100%; }
        .sl-slider-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .sl-slider-badge {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
          color: var(--accent); background: var(--accent-soft);
          padding: 2px 8px; border-radius: 999px; line-height: 1.4;
        }
        .sl-slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 6px; border-radius: 3px; border: none; outline: none;
          cursor: pointer;
        }
        .sl-slider::-webkit-slider-runnable-track {
          height: 6px; border-radius: 3px;
        }
        .sl-slider::-moz-range-track {
          height: 6px; border-radius: 3px; background: var(--track);
        }
        .sl-slider::-moz-range-progress {
          height: 6px; border-radius: 3px; background: var(--accent);
        }
        .sl-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 14px; height: 14px; margin-top: -4px;
          border-radius: 3px; border: 2px solid var(--accent);
          background: var(--panel); cursor: pointer;
          box-shadow: 0 0 6px rgba(255,180,84,0.4);
        }
        .sl-slider::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 3px; border: 2px solid var(--accent);
          background: var(--panel); cursor: pointer;
          box-shadow: 0 0 6px rgba(255,180,84,0.4);
        }
        .sl-slider:disabled { opacity: 0.4; cursor: not-allowed; }
        .sl-slider-endpoints {
          display: flex; justify-content: space-between; margin-top: 4px;
          font-size: 10px; color: var(--text-muted); font-weight: 500;
        }

        .sl-btn {
          height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--panel2); color: var(--text); font-size: 13px; font-weight: 600;
          display: flex; align-items: center; gap: 6px; cursor: pointer;
          transition: transform 0.1s ease, border-color 0.15s ease;
        }
        .sl-btn:hover:not(:disabled) { border-color: var(--accent); }
        .sl-btn:active:not(:disabled) { transform: scale(0.97); }
        .sl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sl-btn-primary {
          background: var(--accent); color: var(--bg); border-color: var(--accent);
        }
        .sl-btn-group { display: flex; gap: 8px; flex-wrap: wrap; }

        .sl-content-grid {
          display: grid; grid-template-columns: 1.7fr 1fr; gap: 18px; align-items: start;
        }
        @media (max-width: 980px) {
          .sl-content-grid { grid-template-columns: 1fr; }
        }

        .sl-viz-card { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
        .sl-viz-frame {
          position: relative;
          height: 340px;
          border-radius: 10px;
          background: var(--track);
          border: 1px solid var(--border);
          overflow: hidden;
          display: flex; align-items: flex-end; gap: 2px;
          padding: 10px 10px 0;
        }
        .sl-viz-frame::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(
            to bottom, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px,
            transparent 1px, transparent 26px
          );
        }
        .sl-bar {
          flex: 1 1 auto;
          border-radius: 3px 3px 0 0;
          transition: height 0.08s linear, background-color 0.08s linear, box-shadow 0.12s ease;
          min-width: 2px;
        }
        .sl-legend {
          display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: var(--text-muted);
        }
        .sl-legend-item { display: flex; align-items: center; gap: 6px; }
        .sl-legend-dot { width: 10px; height: 10px; border-radius: 3px; }

        .sl-stats-strip {
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;
        }
        @media (max-width: 700px) {
          .sl-stats-strip { grid-template-columns: repeat(2, 1fr); }
        }
        .sl-stat {
          background: var(--panel2); border: 1px solid var(--border); border-radius: 9px;
          padding: 10px 12px;
        }
        .sl-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
        .sl-stat-val { font-size: 18px; font-weight: 600; margin-top: 2px; }

        .sl-info-card { padding: 18px; display: flex; flex-direction: column; gap: 14px; max-height: 640px; overflow-y: auto; }
        .sl-info-title { font-size: 16px; font-weight: 700; }
        .sl-info-desc { font-size: 13px; line-height: 1.55; color: var(--text-muted); }
        .sl-info-section-title {
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--accent); font-weight: 700; margin-bottom: 6px;
        }
        .sl-info-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
        .sl-info-list li { font-size: 13px; line-height: 1.5; padding-left: 14px; position: relative; }
        .sl-info-list li::before {
          content: '\u2013'; position: absolute; left: 0; color: var(--text-muted);
        }
        .sl-badges { display: flex; gap: 8px; flex-wrap: wrap; }
        .sl-badge {
          font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 999px;
          border: 1px solid var(--border); background: var(--panel2);
        }
        .sl-complexity-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
        }
        .sl-complexity-cell {
          background: var(--panel2); border: 1px solid var(--border); border-radius: 8px;
          padding: 8px 10px; text-align: center;
        }
        .sl-complexity-cell .k { font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
        .sl-complexity-cell .v { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; margin-top: 2px; }

        .sl-table-card { padding: 18px; overflow-x: auto; }
        table.sl-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 640px; }
        table.sl-table th, table.sl-table td {
          text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--border);
        }
        table.sl-table th { color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
        table.sl-table td.mono { font-family: 'JetBrains Mono', monospace; }
        table.sl-table tr.active-row td { background: var(--accent-soft); }

        .sl-footer {
          border-top: 1px solid var(--border); padding: 20px 22px; margin-top: 10px;
          display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px;
          font-size: 12px; color: var(--text-muted);
        }
        .sl-footer a { color: var(--text-muted); text-decoration: none; }
        .sl-footer a:hover { color: var(--accent); }

        .sl-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px;
        }
        .sl-modal {
          background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
          max-width: 480px; width: 100%; padding: 22px;
        }
        .sl-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .sl-custom-box { padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; }
        .sl-input {
          height: 36px; border-radius: 8px; border: 1px solid var(--border); background: var(--panel2);
          color: var(--text); padding: 0 12px; font-size: 13px; font-family: 'JetBrains Mono', monospace;
        }
        .sl-error { color: var(--bar-swap); font-size: 12px; }
      `}</style>

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
                />
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
            <div>
              <div className="sl-info-title sl-display">{algo.label}</div>
              <p className="sl-info-desc" style={{ marginTop: 8 }}>{algo.description}</p>
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
      </div>

      {/* FOOTER */}
      <footer className="sl-footer">
        <div style={{ display: "flex", gap: 16 }}>
          <a href="https://github.com/NiranjanS8/sorting-algorithm-visualizer" target="_blank" rel="noreferrer">GitHub Repository</a>
          <span>MIT License</span>
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
