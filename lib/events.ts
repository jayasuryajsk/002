import { EventEmitter } from "events"

const eventEmitter = new EventEmitter()

// Increase max listeners to handle multiple SSE connections
eventEmitter.setMaxListeners(100)

export function emitEvent(eventName: string, data: any) {
  eventEmitter.emit(eventName, data)
}

export function onEvent(eventName: string, callback: (data: any) => void) {
  eventEmitter.on(eventName, callback)
  return () => eventEmitter.off(eventName, callback)
}

export function once(eventName: string, callback: (data: any) => void) {
  eventEmitter.once(eventName, callback)
  return () => eventEmitter.off(eventName, callback)
} 