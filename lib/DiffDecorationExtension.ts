import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import * as Diff from 'diff';

// Helper function to create a widget for removed text
function createRemovedWidget(text: string) {
  const span = document.createElement('span');
  span.textContent = text;
  span.className = 'diff-removed';
  return span;
}

export interface DiffDecorationOptions {
  diffText: string;
  originalText: string;
}

export const DiffDecorationExtension = Extension.create<DiffDecorationOptions>({
  name: 'diffDecoration',
  addOptions() {
    return {
      diffText: '',
      originalText: '',
    };
  },
  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('diffDecorationPlugin');
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: (_, { doc }) => {
            return DecorationSet.empty;
          },
          apply: (transaction, decorationSet, oldState, newState) => {
            return decorationSet.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations: (state) => {
            const { diffText, originalText } = this.options;
            if (!diffText || !originalText) return DecorationSet.empty;

            const patchedText = Diff.applyPatch(originalText, diffText);
            if (patchedText === false) {
              return DecorationSet.empty;
            }

            // Get diff parts between original and patched text
            const diffParts = Diff.diffWords(originalText, patchedText);
            let pos = 0;
            const decorations: Decoration[] = [];

            diffParts.forEach((part) => {
              const length = part.value.length;
              if (part.added) {
                // Highlight added text
                decorations.push(Decoration.inline(pos, pos + length, { class: 'diff-added' }));
              } else if (part.removed) {
                // For removed text, add a widget to show strikethrough effect
                decorations.push(Decoration.widget(pos, createRemovedWidget(part.value), { side: -1 }));
              }
              pos += length;
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
