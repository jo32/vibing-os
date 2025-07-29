import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { 
  GitHubLogoIcon as Github,
  FigmaLogoIcon as Figma,
  DiscordLogoIcon as Discord,
  LinkedInLogoIcon as Linkedin,
  TwitterLogoIcon as Twitter,
  InstagramLogoIcon as Instagram
} from "@radix-ui/react-icons"
import { 
  Paperclip, 
  Sparkles, 
  Image as ImageIcon
} from "lucide-react"

export default function Home() {
  const quickStarts = [
    "Create a financial app",
    "Design a directory website", 
    "Build a project management app",
    "Make a landing page",
    "Generate a CRM",
    "Build a mobile app"
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <nav className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-8">
            <div className="text-2xl font-bold">VibingOS</div>
            <div className="hidden md:flex items-center space-x-6 text-sm">
              <a href="#" className="text-slate-300 hover:text-white">Community</a>
              <a href="#" className="text-slate-300 hover:text-white">Enterprise</a>
              <a href="#" className="text-slate-300 hover:text-white flex items-center">
                Resources <span className="ml-1">▼</span>
              </a>
              <a href="#" className="text-slate-300 hover:text-white">Careers</a>
              <a href="#" className="text-slate-300 hover:text-white">Pricing</a>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-3">
              <Discord className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer" />
              <Linkedin className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer" />
              <Twitter className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer" />
              <Instagram className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer" />
            </div>
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Sign In
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Get Started
            </Button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          {/* Hero Section */}
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              What do you want to build?
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Create stunning apps & websites by chatting with AI.
            </p>
          </div>

          {/* Input Section */}
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="bg-slate-900 border-slate-700 p-6">
              <Textarea
                placeholder="Type your idea and we'll bring it to life (or /command)"
                className="min-h-[120px] bg-transparent border-none resize-none text-lg placeholder:text-slate-500 focus-visible:ring-0"
              />
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-3">
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2">
                    <Sparkles className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2">
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Import Options */}
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">or import from</p>
              <div className="flex items-center justify-center space-x-4">
                <Button variant="outline" size="sm" className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
                  <Figma className="w-4 h-4 mr-2" />
                  Figma
                </Button>
                <Button variant="outline" size="sm" className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
                  <Github className="w-4 h-4 mr-2" />
                  GitHub
                </Button>
              </div>
            </div>

            {/* Quick Start Options */}
            <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
              {quickStarts.map((item, index) => (
                <Badge 
                  key={index}
                  variant="secondary" 
                  className="cursor-pointer hover:bg-slate-700 bg-slate-800 text-slate-300 border-slate-700 px-3 py-1"
                >
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap justify-center md:justify-between items-center space-y-4 md:space-y-0">
            <div className="flex flex-wrap justify-center items-center space-x-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white">Pricing</a>
              <a href="#" className="hover:text-white">Blog</a>
              <a href="#" className="hover:text-white">Documentation</a>
              <a href="#" className="hover:text-white">Help Center</a>
              <a href="#" className="hover:text-white">Careers</a>
              <a href="#" className="hover:text-white">Terms</a>
              <a href="#" className="hover:text-white">Privacy</a>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 text-sm">⚡</span>
              <span className="text-slate-400 text-sm">StackBlitz</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}