'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Loader2, Upload } from 'lucide-react'

type Message = {
  id: number
  text: string
  sender: 'user' | 'bot' | 'file'
}

declare global {
  interface Window {
    pdfjsLib: any
  }
}

const API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='?'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [pdfContent, setPdfContent] = useState<string>('') // ✅ store parsed pdf
  const chatRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js'
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
    }
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    const fullPrompt = `${input.trim()}\n\n---\n\n${pdfContent}` // ✅ include parsed content in prompt

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: fullPrompt }],
            },
          ],
          tools: [{ googleSearch: {} }],
        }),
      })

      const data = await response.json()

      const botText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        '🤖 Sorry, I could not understand that.'

      const botMessage: Message = {
        id: Date.now() + 1,
        text: botText,
        sender: 'bot',
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      console.error('API Error:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          text: '❌ Error while calling the Gemini API.',
          sender: 'bot',
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== 'application/pdf') return

    const reader = new FileReader()
    reader.onload = async function () {
      const typedArray = new Uint8Array(reader.result as ArrayBuffer)

      const pdf = await window.pdfjsLib.getDocument(typedArray).promise
      let fullText = ''

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const strings = content.items.map((item: any) => item.str)
        fullText += strings.join(' ') + '\n'
      }

      console.log('📄 Parsed PDF Content:\n', fullText)
      setPdfContent(fullText) // ✅ Save to state

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 3,
          text: `📄 Uploaded: ${file.name}`,
          sender: 'file',
        },
      ])
    }

    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-100 to-blue-50">
      <header className="bg-blue-700 text-white text-center py-4 shadow-md text-2xl font-bold tracking-wide">
        VChat Boat
      </header>

      <main
        ref={chatRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl w-full mx-auto"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2 px-2 sm:px-0 ${
              msg.sender === 'user'
                ? 'justify-end'
                : 'justify-start'
            }`}
          >
            {msg.sender === 'bot' && (
              <Avatar>
                <AvatarImage src="/ai-avatar.png" alt="AI" />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
            )}

            <Card
              className={`max-w-[80%] sm:max-w-md text-sm sm:text-base break-words ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white ml-auto'
                  : msg.sender === 'file'
                  ? 'bg-yellow-100 text-black'
                  : 'bg-white text-black mr-auto'
              } shadow-md rounded-xl`}
            >
              <CardContent className="p-3 sm:p-4">{msg.text}</CardContent>
            </Card>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-sm text-gray-500 animate-pulse ml-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Bot is typing...
          </div>
        )}
      </main>

      <footer className="p-4 bg-white border-t flex flex-col sm:flex-row gap-2 shadow-inner max-w-2xl w-full mx-auto">
        <div className="flex gap-2 w-full">
          <Input
            placeholder="Type your message..."
            className="flex-1 rounded-xl border-gray-300 focus-visible:ring-blue-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <Button
            onClick={sendMessage}
            className="rounded-xl px-4 sm:px-6 bg-blue-600 hover:bg-blue-700"
          >
            Send
          </Button>
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border-blue-400 text-blue-700"
          >
            <Upload className="mr-1 h-4 w-4" />
            Upload PDF
          </Button>
        </div>
      </footer>
    </div>
  )
}
