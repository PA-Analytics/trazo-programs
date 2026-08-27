import type { AutonomyService } from './autonomyService.ts'
import type { StallDetector } from './stallDetector.ts'
import type { AutonomyAuditRecord, AutonomyScanResult } from './types.ts'

export interface AutonomySchedulerOptions {
  detector: StallDetector
  autonomyService: AutonomyService
}

export class AutonomyScheduler {
  private readonly detector: StallDetector
  private readonly autonomyService: AutonomyService
  private timer: NodeJS.Timeout | null = null

  constructor(detectorOrOptions: StallDetector | AutonomySchedulerOptions, autonomyService?: AutonomyService) {
    if ('detector' in detectorOrOptions && 'autonomyService' in detectorOrOptions) {
      this.detector = detectorOrOptions.detector
      this.autonomyService = detectorOrOptions.autonomyService
    } else {
      this.detector = detectorOrOptions
      if (!autonomyService) {
        throw new Error('autonomyService is required')
      }
      this.autonomyService = autonomyService
    }
  }

  /**
   * Scans authoritative implementations using StallDetector and feeds
   * qualified events into AutonomyService.
   * Can be invoked directly by local code, tests, or future cloud triggers.
   */
  async runScan(): Promise<AutonomyScanResult> {
    const events = await this.detector.detectStalls()
    const audits: AutonomyAuditRecord[] = []
    const errors: Array<{ implementationId: string; eventId: string; error: string }> = []

    for (const event of events) {
      try {
        const audit = await this.autonomyService.handleStalledLearner(event)
        audits.push(audit)
      } catch (err: unknown) {
        errors.push({
          implementationId: event.implementationId,
          eventId: event.eventId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return {
      scannedCount: events.length,
      qualifiedCount: events.length,
      processedCount: audits.length,
      audits,
      errors,
    }
  }

  /**
   * Starts periodic local polling.
   */
  start(intervalMs: number): void {
    if (this.timer) {
      this.stop()
    }
    this.timer = setInterval(() => {
      this.runScan().catch((err) => {
        console.error('[AutonomyScheduler] Scan execution failed:', err)
      })
    }, intervalMs)
    if (this.timer.unref) {
      this.timer.unref()
    }
  }

  /**
   * Stops periodic local polling.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  isRunning(): boolean {
    return this.timer !== null
  }
}
