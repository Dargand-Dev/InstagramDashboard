import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import EmptyState from '@/components/shared/EmptyState'
import { toast } from 'sonner'
import {
  Settings as SettingsIcon, Users, Calendar, Server,
  Lock, Info, Plus, Pencil, Trash2, Eye, EyeOff,
  CheckCircle, XCircle, Clock,
} from 'lucide-react'

function IdentityRow({ identity, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a] group">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#FAFAFA]">{identity.identityId || identity.name || identity.identityName}</p>
        {(identity.driveFolderId || identity.driveFolder) && (
          <p className="text-xs text-[#52525B] mt-0.5 truncate">{identity.driveFolderId || identity.driveFolder}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon-xs" className="text-[#52525B] hover:text-[#A1A1AA]" onClick={() => onEdit(identity)}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" className="text-[#52525B] hover:text-[#EF4444]" onClick={() => onDelete(identity)}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

function IdentityDialog({ open, onOpenChange, identity, onSave, isPending }) {
  const [name, setName] = useState(identity?.identityId || identity?.name || identity?.identityName || '')
  const [driveFolder, setDriveFolder] = useState(identity?.driveFolderId || identity?.driveFolder || '')

  const isEdit = !!identity?.id

  const handleSave = () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    onSave({ ...identity, identityId: name.trim(), driveFolderId: driveFolder.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{isEdit ? 'Edit Identity' : 'Add Identity'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Identity name"
              className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Drive Folder (optional)</Label>
            <Input
              value={driveFolder}
              onChange={e => setDriveFolder(e.target.value)}
              placeholder="Google Drive folder ID or path"
              className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-[#A1A1AA]">Cancel</Button>
          <Button size="sm" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [identityDialog, setIdentityDialog] = useState({ open: false, identity: null })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })

  // Queries
  const { data: identitiesData, isLoading: identitiesLoading } = useQuery({
    queryKey: ['identities'],
    queryFn: () => apiGet('/api/identities'),
  })

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedule'],
    queryFn: () => apiGet('/api/automation/schedule'),
  })

  const identities = useMemo(() => {
    const raw = identitiesData?.data || identitiesData || []
    return Array.isArray(raw) ? raw : []
  }, [identitiesData])

  const schedule = scheduleData?.data || scheduleData || {}

  // Identity mutations
  const createIdentity = useMutation({
    mutationFn: (data) => apiPost('/api/identities', data),
    onSuccess: () => {
      toast.success('Identity created')
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      setIdentityDialog({ open: false, identity: null })
    },
  })

  const updateIdentity = useMutation({
    mutationFn: (data) => apiPut(`/api/identities/${data.id}`, data),
    onSuccess: () => {
      toast.success('Identity updated')
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      setIdentityDialog({ open: false, identity: null })
    },
  })

  const deleteIdentity = useMutation({
    mutationFn: (id) => apiDelete(`/api/identities/${id}`),
    onSuccess: () => {
      toast.success('Identity deleted')
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      setDeleteTarget(null)
    },
  })

  const handleSaveIdentity = (data) => {
    if (data.id) updateIdentity.mutate(data)
    else createIdentity.mutate(data)
  }

  // Password change
  const changePassword = useMutation({
    mutationFn: (data) => apiPost('/api/auth/change-password', data),
    onSuccess: () => {
      toast.success('Password changed')
      setPasswordForm({ current: '', new: '', confirm: '' })
    },
  })

  const handleChangePassword = () => {
    if (!passwordForm.current || !passwordForm.new) {
      toast.error('Please fill in all fields')
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (passwordForm.new.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    changePassword.mutate({
      currentPassword: passwordForm.current,
      newPassword: passwordForm.new,
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Configuration</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Identities */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#8B5CF6]" />
              Identities
            </CardTitle>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
                onClick={() => setIdentityDialog({ open: true, identity: null })}
              >
                <Plus className="w-3 h-3 mr-1" />Add
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {identitiesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full bg-[#1a1a1a]" />)}
              </div>
            ) : identities.length > 0 ? (
              <div className="space-y-2">
                {identities.map(id => (
                  <IdentityRow
                    key={id.id || id.name}
                    identity={id}
                    onEdit={(identity) => setIdentityDialog({ open: true, identity })}
                    onDelete={(identity) => setDeleteTarget(identity)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} title="No identities" description="Add your first identity to get started" />
            )}
          </CardContent>
        </Card>

        {/* Scheduler Config */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#3B82F6]" />
              Scheduler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduleLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full bg-[#1a1a1a]" />
                <Skeleton className="h-10 w-full bg-[#1a1a1a]" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]">
                  <div className="flex items-center gap-2">
                    {schedule.enabled !== false ? (
                      <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#EF4444]" />
                    )}
                    <span className="text-sm text-[#FAFAFA]">
                      {schedule.enabled !== false ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={schedule.enabled !== false
                      ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20'
                      : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
                    }
                  >
                    {schedule.enabled !== false ? 'ON' : 'OFF'}
                  </Badge>
                </div>

                {(schedule.windows || schedule.postingWindows || schedule.timeWindows) && (
                  <div className="p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]">
                    <p className="text-xs text-[#52525B] mb-2">Posting Windows</p>
                    <div className="space-y-1">
                      {(schedule.windows || schedule.postingWindows || schedule.timeWindows || []).map((w, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Clock className="w-3 h-3 text-[#52525B]" />
                          <span className="text-[#A1A1AA]">
                            {w.start || `${w.startHour}:00`} — {w.end || `${w.endHour}:00`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-3">
                  <p className="text-xs text-[#F59E0B]">
                    Scheduler config is managed via YAML. Edit the backend configuration file to change windows or enable/disable.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auth Settings */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#F59E0B]" />
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-[#A1A1AA]">Current Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                    className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] pr-9"
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA]"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#A1A1AA]">New Password</Label>
                <Input
                  type="password"
                  value={passwordForm.new}
                  onChange={e => setPasswordForm(p => ({ ...p, new: e.target.value }))}
                  className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#A1A1AA]">Confirm New Password</Label>
                <Input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                  className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
                />
              </div>
              <Button
                size="sm"
                className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                onClick={handleChangePassword}
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <Server className="w-4 h-4 text-[#22C55E]" />
              System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Dashboard', value: 'v2.0.0', icon: Info },
                { label: 'API Backend', value: 'localhost:8081', icon: Server },
                { label: 'Framework', value: 'React 19 + Vite', icon: SettingsIcon },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-[#52525B]" />
                    <span className="text-xs text-[#52525B]">{label}</span>
                  </div>
                  <span className="text-xs text-[#A1A1AA] font-mono">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Identity Dialog */}
      <IdentityDialog
        open={identityDialog.open}
        onOpenChange={(open) => setIdentityDialog({ open, identity: open ? identityDialog.identity : null })}
        identity={identityDialog.identity}
        onSave={handleSaveIdentity}
        isPending={createIdentity.isPending || updateIdentity.isPending}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Identity</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#A1A1AA]">
            Are you sure you want to delete <span className="text-[#FAFAFA] font-medium">{deleteTarget?.identityId || deleteTarget?.name || deleteTarget?.identityName}</span>?
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} className="text-[#A1A1AA]">Cancel</Button>
            <Button
              size="sm"
              className="bg-[#EF4444] hover:bg-[#DC2626] text-white"
              onClick={() => deleteIdentity.mutate(deleteTarget.id)}
              disabled={deleteIdentity.isPending}
            >
              {deleteIdentity.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
