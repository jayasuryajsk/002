import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronDown, ChevronRight, FileCode, Terminal, Type, Plus, X } from "lucide-react"

export default function CodeEditor() {
  return (
    <div className="flex h-screen bg-zinc-900 text-zinc-100">
      {/* Left Sidebar - File Explorer */}
      <div className="w-64 border-r border-zinc-800">
        <ScrollArea className="h-[calc(100vh-24px)]">
          <div className="p-2">
            <div className="mb-2">
              <div className="flex items-center gap-1 text-sm text-zinc-400 py-1">
                <ChevronDown className="w-4 h-4" />
                <span className="font-medium">AI-CHATBOT</span>
              </div>
              {/* Components Section */}
              <div className="ml-2">
                <div className="flex items-center gap-1 text-sm text-zinc-400 py-1">
                  <ChevronDown className="w-4 h-4" />
                  <span>components</span>
                </div>
                <div className="ml-4 space-y-1">
                  <div className="flex items-center gap-1 text-sm text-zinc-400 py-1">
                    <FileCode className="w-4 h-4 text-zinc-500" />
                    <span>messages.tsx</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-blue-400 py-1">
                    <FileCode className="w-4 h-4" />
                    <span>model-selector.tsx</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-zinc-400 py-1">
                    <FileCode className="w-4 h-4 text-zinc-500" />
                    <span>overview.tsx</span>
                  </div>
                </div>
              </div>
              {/* Hooks Section */}
              <div className="ml-2">
                <div className="flex items-center gap-1 text-sm text-zinc-400 py-1">
                  <ChevronRight className="w-4 h-4" />
                  <span>hooks</span>
                </div>
              </div>
              {/* Lib Section */}
              <div className="ml-2">
                <div className="flex items-center gap-1 text-sm text-zinc-400 py-1">
                  <ChevronRight className="w-4 h-4" />
                  <span>lib</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Tab Bar */}
        <div className="bg-zinc-900 border-b border-zinc-800">
          <Tabs defaultValue="prompts" className="w-full">
            <TabsList className="bg-transparent border-b border-zinc-800 h-9 rounded-none p-0">
              <TabsTrigger
                value="prompts"
                className="rounded-none border-r border-zinc-800 h-full px-4 text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
              >
                prompts.ts
              </TabsTrigger>
              <TabsTrigger
                value="route"
                className="rounded-none border-r border-zinc-800 h-full px-4 text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
              >
                route.ts
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Editor Area */}
        <div className="flex-1 bg-zinc-900 p-4">
          <pre className="text-sm text-zinc-100 font-mono">
            <code>{`// Editor content would go here
export const prompts = {
  // ...
}`}</code>
          </pre>
        </div>
      </div>

      {/* Right Sidebar - Chat UI */}
      <div className="w-[450px] border-l border-zinc-800 bg-zinc-900 flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">CHAT</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* System Message */}
            <div className="text-xs text-zinc-400">claude-3-5-sonnet-20241022</div>

            {/* Message Thread */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Assistant</span>
                </div>
                <div className="text-sm text-zinc-300">
                  Document management sections for:
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li>Other Docs</li>
                    <li>Past Tenders</li>
                    <li>Capability Docs</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">User</span>
                </div>
                <div className="text-sm text-zinc-300">
                  Each document section features:
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li>Upload functionality (drag & drop + button)</li>
                    <li>Document count</li>
                    <li>Indexing status</li>
                    <li>Last indexed time</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Chat Input */}
        <div className="p-4 border-t border-zinc-800">
          <div className="relative">
            <textarea
              placeholder="Ask agent to do anything, @ to mention, ↑ to select"
              className="w-full h-24 bg-zinc-800 text-sm rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-700"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 bottom-2 text-xs bg-zinc-700 hover:bg-zinc-600"
            >
              Stop
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-zinc-400">
            <span>Start new chat with summary →</span>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-6 bg-zinc-800 border-t border-zinc-700 flex items-center px-2 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3" />
          <span>main</span>
          <Type className="w-3 h-3" />
          <span>TypeScript</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span>Ln 1, Col 1</span>
          <span>Spaces: 2</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  )
}

