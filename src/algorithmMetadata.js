import {
  bubbleSortGen,
  selectionSortGen,
  insertionSortGen,
  mergeSortGen,
  quickSortGen,
  heapSortGen,
  shellSortGen,
  countingSortGen,
  radixSortGen,
} from "./sortingAlgorithms";

/* ============================================================
   ALGORITHM METADATA
   ============================================================ */

export const ALGORITHMS = {
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

export const ALGO_ORDER = [
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
