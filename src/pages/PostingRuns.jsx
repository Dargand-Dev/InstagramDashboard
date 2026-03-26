import { RunsTab } from './Activity'

export default function PostingRuns() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Posting Runs</h1>
        <p className="text-xs text-[#333] mt-0.5">Reel posting execution history</p>
      </div>
      <RunsTab workflowFilter="posting" />
    </div>
  )
}
