import type { LoggerConfig } from '@go-corp/utils/debug'
import type { TestRunnerConfig } from './config.js'
import {
  ExitCode,

  LogLevel,
  StructuredLogger,
} from '@go-corp/utils/debug'

// Re-export for backward compatibility
export { ExitCode, LogLevel }

/**
 * Test Runner Logger - Wrapper around StructuredLogger for backward compatibility
 */
export class Logger extends StructuredLogger {
  private testConfig: TestRunnerConfig

  constructor(config: TestRunnerConfig) {
    const loggerConfig: LoggerConfig = {
      verbose: config.verbose,
      source: 'go-test-suite',
      telemetry: config.telemetry,
    }
    super(loggerConfig)
    this.testConfig = config
  }

  /**
   * Override trackTelemetry to include test runner specific properties
   */
  trackTelemetry(name: string, properties: Record<string, any> = {}): void {
    const enhancedProperties = {
      ...properties,
      runtime: this.testConfig.runtime,
      database: this.testConfig.database,
    }
    super.trackTelemetry(name, enhancedProperties)
  }
}

// Re-export functions from go-utils for convenience
export { formatError, setupErrorHandlers } from '@go-corp/utils/debug'
