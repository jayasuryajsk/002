import React, { forwardRef } from 'react'
import { motion } from 'framer-motion'

export interface Suggestion {
  text: string
  description?: string
}

interface SuggestionListProps {
  items: Suggestion[]
  command: (item: Suggestion) => void
  className?: string
  selectedIndex: number
}

export const SuggestionList = forwardRef<HTMLDivElement, SuggestionListProps>(
  ({ items, command, className, selectedIndex }, ref) => {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        ref={ref}
        className="z-50 w-72 overflow-hidden rounded-md border border-gray-200 bg-white shadow-md"
      >
        <div className="max-h-60 overflow-y-auto p-1">
          {items.map((item, index) => (
            <button
              key={index}
              className={`flex w-full items-start space-x-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100 ${
                index === selectedIndex ? 'bg-gray-100' : ''
              }`}
              onClick={() => command(item)}
            >
              <div className="flex-1">
                <div className="text-sm font-medium">{item.text}</div>
                {item.description && (
                  <div className="text-xs text-gray-500">{item.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    )
  }
)

SuggestionList.displayName = 'SuggestionList' 