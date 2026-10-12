export type TransactionMetrics = {
  bytesRead: number;
  bytesWritten: number;
  databaseQueries: number;
  documentsRead: number;
  documentsWritten: number;
  functionsScheduled: number;
  scheduledFunctionArgsBytes: number;
};

const READ_METRIC_KEYS: (keyof TransactionMetrics)[] = [
  "bytesRead",
  "documentsRead",
  "databaseQueries",
];

const MiB = 1 << 20;

const DEFAULT_TRANSACTION_LIMITS: TransactionMetrics = {
  bytesRead: 16 * MiB,
  bytesWritten: 16 * MiB,
  documentsRead: 32_000,
  databaseQueries: 4096,
  documentsWritten: 16_000,
  functionsScheduled: 1000,
  scheduledFunctionArgsBytes: 16 * MiB,
};

function zeroMetrics(): TransactionMetrics {
  return {
    bytesRead: 0,
    bytesWritten: 0,
    documentsRead: 0,
    documentsWritten: 0,
    databaseQueries: 0,
    functionsScheduled: 0,
    scheduledFunctionArgsBytes: 0,
  };
}

type MetricsLayer = {
  metrics: TransactionMetrics;
  limits: TransactionMetrics;
  enforce: boolean;
};

export class TransactionMetricsTracker {
  private _config: Partial<TransactionMetrics> | boolean;
  private _layers: MetricsLayer[] = [];

  constructor(config: Partial<TransactionMetrics> | boolean = false) {
    this._config = config;
  }

  startTransaction(transactionLimits?: Partial<TransactionMetrics>) {
    const parent = this._current();
    this._layers.push(
      parent === undefined ? this._rootLayer() : this._childLayer(parent, transactionLimits),
    );
  }

  commit() {
    const child = this._pop();
    const parent = this._current();
    if (parent !== undefined) {
      parent.metrics = { ...child.metrics };
    }
  }

  rollback() {
    const child = this._pop();
    const parent = this._current();
    if (parent !== undefined) {
      for (const key of READ_METRIC_KEYS) {
        parent.metrics[key] = child.metrics[key];
      }
    }
  }

  trackRead(docSizeBytes: number) {
    const layer = this._current();
    if (layer === undefined) {
      return;
    }
    layer.metrics.bytesRead += docSizeBytes;
    layer.metrics.documentsRead += 1;
    if (layer.enforce) {
      if (layer.metrics.bytesRead > layer.limits.bytesRead) {
        throw new Error(
          `Read too much data in a single function execution (limit: ${layer.limits.bytesRead} bytes). ` +
            "This is a Convex limit: https://docs.convex.dev/production/state/limits",
        );
      }
      if (layer.metrics.documentsRead > layer.limits.documentsRead) {
        throw new Error(
          `Scanned too many documents in a single function execution (limit: ${layer.limits.documentsRead}). ` +
            "This is a Convex limit: https://docs.convex.dev/production/state/limits",
        );
      }
    }
  }

  trackWrite(docSizeBytes: number) {
    const layer = this._current();
    if (layer === undefined) {
      return;
    }
    layer.metrics.bytesWritten += docSizeBytes;
    layer.metrics.documentsWritten += 1;
    if (layer.enforce) {
      if (layer.metrics.bytesWritten > layer.limits.bytesWritten) {
        throw new Error(
          `Wrote too much data in a single function execution (limit: ${layer.limits.bytesWritten} bytes). ` +
            "This is a Convex limit: https://docs.convex.dev/production/state/limits",
        );
      }
      if (layer.metrics.documentsWritten > layer.limits.documentsWritten) {
        throw new Error(
          `Wrote too many documents in a single function execution (limit: ${layer.limits.documentsWritten}). ` +
            "This is a Convex limit: https://docs.convex.dev/production/state/limits",
        );
      }
    }
  }

  trackIndexRange() {
    const layer = this._current();
    if (layer === undefined) {
      return;
    }
    layer.metrics.databaseQueries += 1;
    if (layer.enforce && layer.metrics.databaseQueries > layer.limits.databaseQueries) {
      throw new Error(
        `Too many index ranges read in a single function execution (limit: ${layer.limits.databaseQueries}). ` +
          "This is a Convex limit: https://docs.convex.dev/production/state/limits",
      );
    }
  }

  trackScheduledFunction(argsSizeBytes: number) {
    const layer = this._current();
    if (layer === undefined) {
      return;
    }
    layer.metrics.functionsScheduled += 1;
    layer.metrics.scheduledFunctionArgsBytes += argsSizeBytes;
    if (layer.enforce) {
      if (layer.metrics.functionsScheduled > layer.limits.functionsScheduled) {
        throw new Error(
          `Scheduled too many functions in a single function execution (limit: ${layer.limits.functionsScheduled}). ` +
            "This is a Convex limit: https://docs.convex.dev/production/state/limits",
        );
      }
      if (layer.metrics.scheduledFunctionArgsBytes > layer.limits.scheduledFunctionArgsBytes) {
        throw new Error(
          `Scheduled function arguments too large in a single function execution (limit: ${layer.limits.scheduledFunctionArgsBytes} bytes). ` +
            "This is a Convex limit: https://docs.convex.dev/production/state/limits",
        );
      }
    }
  }

  getTransactionMetrics() {
    const layer = this._current();
    if (layer === undefined) {
      throw new Error("Transaction not started");
    }
    const { metrics, limits } = layer;
    return {
      bytesRead: {
        used: metrics.bytesRead,
        remaining: limits.bytesRead - metrics.bytesRead,
      },
      bytesWritten: {
        used: metrics.bytesWritten,
        remaining: limits.bytesWritten - metrics.bytesWritten,
      },
      databaseQueries: {
        used: metrics.databaseQueries,
        remaining: limits.databaseQueries - metrics.databaseQueries,
      },
      documentsRead: {
        used: metrics.documentsRead,
        remaining: limits.documentsRead - metrics.documentsRead,
      },
      documentsWritten: {
        used: metrics.documentsWritten,
        remaining: limits.documentsWritten - metrics.documentsWritten,
      },
      functionsScheduled: {
        used: metrics.functionsScheduled,
        remaining: limits.functionsScheduled - metrics.functionsScheduled,
      },
      scheduledFunctionArgsBytes: {
        used: metrics.scheduledFunctionArgsBytes,
        remaining: limits.scheduledFunctionArgsBytes - metrics.scheduledFunctionArgsBytes,
      },
    };
  }

  private _current(): MetricsLayer | undefined {
    return this._layers[this._layers.length - 1];
  }

  private _pop(): MetricsLayer {
    const layer = this._layers.pop();
    if (layer === undefined) {
      throw new Error("Transaction not started");
    }
    return layer;
  }

  private _rootLayer(): MetricsLayer {
    if (this._config === false) {
      return {
        metrics: zeroMetrics(),
        limits: { ...DEFAULT_TRANSACTION_LIMITS },
        enforce: false,
      };
    }
    if (this._config === true) {
      return {
        metrics: zeroMetrics(),
        limits: { ...DEFAULT_TRANSACTION_LIMITS },
        enforce: true,
      };
    }
    return {
      metrics: zeroMetrics(),
      limits: { ...DEFAULT_TRANSACTION_LIMITS, ...this._config },
      enforce: true,
    };
  }

  private _childLayer(
    parent: MetricsLayer,
    transactionLimits?: Partial<TransactionMetrics>,
  ): MetricsLayer {
    const limits = { ...parent.limits };
    if (transactionLimits !== undefined) {
      for (const key of Object.keys(limits) as (keyof TransactionMetrics)[]) {
        const requested = transactionLimits[key];
        if (requested !== undefined) {
          limits[key] = Math.min(parent.limits[key], parent.metrics[key] + requested);
        }
      }
    }
    return {
      metrics: { ...parent.metrics },
      limits,
      enforce: parent.enforce || transactionLimits !== undefined,
    };
  }
}
