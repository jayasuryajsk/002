import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

interface PluginState {
  decorations: DecorationSet
  prediction: string
  lastText: string
}

export interface SuggestionOptions {
  prediction: (text: string) => Promise<string>
}

export const Suggestions = Extension.create<SuggestionOptions>({
  name: 'suggestions',

  addOptions() {
    return {
      prediction: () => Promise.resolve(''),
    }
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('suggestions')
    const extensionThis = this

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(): PluginState {
            return {
              decorations: DecorationSet.empty,
              prediction: '',
              lastText: ''
            }
          },
          apply(tr, pluginState: PluginState): PluginState {
            const meta = tr.getMeta(pluginKey)
            
            if (meta?.clear) {
              return {
                decorations: DecorationSet.empty,
                prediction: '',
                lastText: pluginState.lastText
              }
            }

            if (meta?.add) {
              const { $head } = tr.selection
              const decoration = Decoration.widget($head.pos, () => {
                const span = document.createElement('span')
                span.textContent = meta.prediction
                span.style.cssText = 'color: #666; opacity: 0.5; user-select: none; pointer-events: none;'
                return span
              }, { side: 1 })

              return {
                decorations: DecorationSet.create(tr.doc, [decoration]),
                prediction: meta.prediction,
                lastText: meta.text || pluginState.lastText
              }
            }

            // If the document changed, clear decorations
            if (tr.docChanged) {
              return {
                decorations: DecorationSet.empty,
                prediction: '',
                lastText: pluginState.lastText
              }
            }

            // Map decorations to new positions if needed
            const mapped = pluginState.decorations.map(tr.mapping, tr.doc)
            return { ...pluginState, decorations: mapped }
          }
        },
        props: {
          decorations(state) {
            const pluginState = pluginKey.getState(state)
            return pluginState?.decorations || DecorationSet.empty
          },
          handleKeyDown(view, event) {
            if (event.key === 'Tab' || (event.key === 'ArrowRight' && event.ctrlKey)) {
              const pluginState = pluginKey.getState(view.state)
              if (pluginState?.prediction) {
                const tr = view.state.tr
                  .insertText(pluginState.prediction)
                  .setMeta(pluginKey, { clear: true })
                view.dispatch(tr)

                // Get new text and request next prediction
                const { $head } = view.state.selection
                const newText = $head.parent.textContent.slice(0, $head.parentOffset)
                if (newText.trim().length >= 3) {
                  extensionThis.options.prediction(newText).then(prediction => {
                    if (prediction) {
                      const nextTr = view.state.tr.setMeta(pluginKey, {
                        add: true,
                        prediction,
                        text: newText
                      })
                      view.dispatch(nextTr)
                    }
                  })
                }
                return true
              }
            }
            return false
          },
          handleDOMEvents: {
            keyup: (view) => {
              const state = view.state
              const { selection } = state
              const { $head } = selection

              if (!$head.parent.isTextblock) {
                return false
              }

              const textBeforeCursor = $head.parent.textContent.slice(0, $head.parentOffset)
              
              if (textBeforeCursor.trim().length < 3) {
                const tr = state.tr.setMeta(pluginKey, { clear: true })
                view.dispatch(tr)
                return false
              }

              // Only request prediction if text has changed
              const pluginState = pluginKey.getState(state)
              if (textBeforeCursor === pluginState?.lastText) {
                return false
              }

              extensionThis.options.prediction(textBeforeCursor).then(prediction => {
                if (prediction) {
                  const tr = view.state.tr.setMeta(pluginKey, {
                    add: true,
                    prediction,
                    text: textBeforeCursor
                  })
                  view.dispatch(tr)
                }
              })

              return false
            }
          }
        }
      })
    ]
  }
}) 