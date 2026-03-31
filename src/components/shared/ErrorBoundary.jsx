import { Component } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('UI Error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <Card className="bg-[#111111] border-[#1a1a1a] max-w-md w-full">
            <CardContent className="flex flex-col items-center text-center py-12 px-6 gap-4">
              <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[#EF4444]" />
              </div>
              <h2 className="text-lg font-semibold text-[#FAFAFA]">Something went wrong</h2>
              <p className="text-sm text-[#52525B]">
                An unexpected error occurred. Please reload the page to continue.
              </p>
              <Button
                className="mt-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                onClick={() => window.location.reload()}
              >
                Reload
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
