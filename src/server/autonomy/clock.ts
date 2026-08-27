import type { IClock } from './types.ts'

export class SystemClock implements IClock {
  now(): Date {
    return new Date()
  }
}

export class FakeClock implements IClock {
  private currentTime: number

  constructor(initialTime: string | number | Date = '2026-08-24T12:00:00.000Z') {
    this.currentTime = new Date(initialTime).getTime()
  }

  now(): Date {
    return new Date(this.currentTime)
  }

  setTime(time: string | number | Date): void {
    this.currentTime = new Date(time).getTime()
  }

  advanceByMs(ms: number): void {
    this.currentTime += ms
  }

  advanceByMinutes(minutes: number): void {
    this.currentTime += minutes * 60 * 1000
  }

  advanceByHours(hours: number): void {
    this.currentTime += hours * 60 * 60 * 1000
  }

  advanceByDays(days: number): void {
    this.currentTime += days * 24 * 60 * 60 * 1000
  }
}
