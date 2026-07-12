class CircuitBreaker {
  constructor(name, failureThreshold, resetTimeoutMs) {
    this.name = name;
    this.failureCount = 0;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
    this._halfOpenProbing = false;
  }

  isDisabled() {
    if (this.state === 'CLOSED') return false;
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        if (this._halfOpenProbing) return true;
        this._halfOpenProbing = true;
        return false;
      }
      return true;
    }
    if (this._halfOpenProbing) return true;
    this._halfOpenProbing = true;
    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this._halfOpenProbing = false;
  }

  recordFailure() {
    const wasHalfOpen = this.state === 'HALF_OPEN';
    this._halfOpenProbing = false;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (wasHalfOpen || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.timestamps = [];
    this._head = 0;
  }

  canProceed() {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    while (this._head < this.timestamps.length && this.timestamps[this._head] <= cutoff) {
      this._head++;
    }
    if (this._head > 100) {
      this.timestamps = this.timestamps.slice(this._head);
      this._head = 0;
    }
    return (this.timestamps.length - this._head) < this.maxRequests;
  }

  record() {
    this.timestamps.push(Date.now());
  }

  async waitAndProceed() {
    if (this.canProceed()) {
      this.record();
      return;
    }
    const oldest = this.timestamps[this._head];
    const waitMs = Math.max(0, this.windowMs - (Date.now() - oldest) + 1);
    await new Promise(r => setTimeout(r, waitMs));
    while (!this.canProceed()) {
      const nextOldest = this.timestamps[this._head];
      const nextWait = Math.max(0, this.windowMs - (Date.now() - nextOldest) + 1);
      await new Promise(r => setTimeout(r, nextWait));
    }
    this.record();
  }
}
