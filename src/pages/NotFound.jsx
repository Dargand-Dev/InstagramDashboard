import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4">
        <FileQuestion className="w-6 h-6 text-[#52525B]" />
      </div>
      <h1 className="text-xl font-semibold text-[#FAFAFA] mb-1">Page not found</h1>
      <p className="text-sm text-[#52525B] mb-6">The page you're looking for doesn't exist.</p>
      <Button asChild className="bg-[#3B82F6] hover:bg-[#2563EB] text-white">
        <Link to="/">Back to Dashboard</Link>
      </Button>
    </div>
  )
}
