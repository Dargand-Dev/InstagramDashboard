import { RunsTab } from './Activity'

export default function CreationRuns() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Account Creation Runs</h1>
        <p className="text-xs text-[#333] mt-0.5">Account creation execution history</p>
      </div>
      <RunsTab workflowFilter="creation" />
    </div>
  )
}
