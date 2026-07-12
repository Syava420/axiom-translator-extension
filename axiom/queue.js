class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

class TranslationQueue {
  constructor(translateFn, concurrency = CONFIG.QUEUE.MAX_CONCURRENCY) {
    this.translateFn = translateFn;
    this.concurrency = concurrency;
    this.queue = [];
    this.priorityQueue = [];
    this.active = 0;
    this.dedupeMap = new Map();
  }

  enqueue(text, priority = false, skipStats = false) {
    if (this.dedupeMap.has(text)) {
      if (priority) {
        const idx = this.queue.findIndex(item => item.text === text);
        if (idx !== -1) {
          const [item] = this.queue.splice(idx, 1);
          this.priorityQueue.push(item);
          this._processNext();
        }
      }
      return this.dedupeMap.get(text);
    }

    const promise = new Promise((resolve, reject) => {
      if (priority) {
        this.priorityQueue.push({ text, resolve, reject, skipStats });
      } else {
        this.queue.push({ text, resolve, reject, skipStats });
      }
      this._processNext();
    });

    this.dedupeMap.set(text, promise);
    promise.finally(() => this.dedupeMap.delete(text));

    return promise;
  }

  _processNext() {
    while (this.priorityQueue.length > 0 && this.active < this.concurrency + 5) {
      this.active++;
      const item = this.priorityQueue.shift();
      this._run(item.text, item.resolve, item.reject, true, item.skipStats);
    }
    while (this.active < this.concurrency && this.queue.length > 0) {
      this.active++;
      const item = this.queue.shift();
      this._run(item.text, item.resolve, item.reject, false, item.skipStats);
    }
  }

  async _run(text, resolve, reject, priority, skipStats) {
    try {
      const result = await this.translateFn(text, priority, skipStats);
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.active--;
      this._processNext();
    }
  }
}
