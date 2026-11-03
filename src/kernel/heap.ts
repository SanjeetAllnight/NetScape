/**
 * Generic pure Binary Min-Heap primitive.
 * Used for deterministic priority queue operations such as Dijkstra shortest path.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §14
 */

export class BinaryHeap<T> {
  private data: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  get size(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) {
      return undefined;
    }
    const root = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last !== undefined) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return root;
  }

  clear(): void {
    this.data = [];
  }

  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      const currentItem = this.data[current];
      const parentItem = this.data[parent];
      if (currentItem !== undefined && parentItem !== undefined && this.compare(currentItem, parentItem) < 0) {
        this.data[current] = parentItem;
        this.data[parent] = currentItem;
        current = parent;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    let current = index;
    const length = this.data.length;

    while (true) {
      const left = 2 * current + 1;
      const right = 2 * current + 2;
      let smallest = current;

      const currentItem = this.data[current];
      const leftItem = this.data[left];
      const rightItem = this.data[right];

      if (left < length && leftItem !== undefined && currentItem !== undefined && this.compare(leftItem, this.data[smallest]!) < 0) {
        smallest = left;
      }

      if (right < length && rightItem !== undefined && this.compare(rightItem, this.data[smallest]!) < 0) {
        smallest = right;
      }

      if (smallest !== current) {
        const temp = this.data[current]!;
        this.data[current] = this.data[smallest]!;
        this.data[smallest] = temp;
        current = smallest;
      } else {
        break;
      }
    }
  }
}
