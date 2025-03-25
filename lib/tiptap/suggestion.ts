import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { Plugin } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'

export interface PluginState {
  decorations: DecorationSet
  prediction: string
  lastText?: string
}

export interface SuggestionOptions {
  prediction: (text: string) => Promise<string>
}

export const Suggestions = Extension.create<SuggestionOptions>({
  name: 'suggestions',

  addOptions() {
    return {
      // Return empty prediction function that does nothing
      prediction: () => Promise.resolve(''),
    }
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('suggestions')

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(): PluginState {
            return {
              decorations: DecorationSet.empty,
              prediction: '',
            }
          },
          apply(tr, pluginState) {
            // Always return empty state to prevent any suggestions
            return {
              decorations: DecorationSet.empty,
              prediction: '',
            }
          },
        },
        props: {
          // Empty decorations to prevent any auto-complete UI
          decorations(state) {
            return DecorationSet.empty
          },
          // No-op for all key handlers
          handleKeyDown() {
            return false
          },
          handleDOMEvents: {
            keyup() {
              return false
            }
          }
        },
      }),
    ]
  },
}) 