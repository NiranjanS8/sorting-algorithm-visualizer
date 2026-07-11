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

export function* bubbleSortGen(arr) {
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

export function* selectionSortGen(arr) {
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

export function* insertionSortGen(arr) {
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

export function* mergeSortGen(arr, lo = 0, hi = arr.length - 1) {
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

export function* quickSortGen(arr, lo = 0, hi = arr.length - 1) {
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

export function* heapSortGen(arr) {
  const n = arr.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) yield* heapifyGen(arr, n, i);
  for (let i = n - 1; i > 0; i--) {
    yield { type: "swap", indices: [0, i] };
    yield* heapifyGen(arr, i, 0);
  }
}

export function* shellSortGen(arr) {
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

export function* countingSortGen(arr) {
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

export function* radixSortGen(arr) {
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
