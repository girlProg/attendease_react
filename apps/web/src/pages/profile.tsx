import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useLogVisit } from "@/hooks/use-log-visit"
import { api } from "@/lib/api"

interface UserProfile {
  id: number
  email: string
  first_name: string
  last_name: string
  phone_number: string
  photo: string | null
}

const getProfile = () =>
  api.get<UserProfile>("/auth/profile/").then((response) => response.data)

const updateProfile = (data: Partial<UserProfile>) =>
  api.put<UserProfile>("/auth/profile/", data).then((response) => response.data)

const updatePhoto = (file: File) => {
  const formData = new FormData()
  formData.append("photo", file)
  return api.put<UserProfile>("/auth/profile/photo/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((response) => response.data)
}

const changePassword = (data: { old_password: string; new_password: string; confirm_new_password: string }) =>
  api.post("/auth/change-password/", data).then((response) => response.data)

function handleLogout() {
  localStorage.removeItem("access")
  localStorage.removeItem("refresh")
  window.location.href = "/login"
}

function ProfileView({ profile, onEdit }: { profile: UserProfile; onEdit: () => void }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-white p-8">
      <div className="flex items-start gap-6">
        <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-muted">
          {profile.photo ? (
            <img src={profile.photo} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <svg className="size-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            {profile.first_name} {profile.last_name}
          </h2>
          <Button
            className="h-8 rounded-full bg-sidebar px-4 text-xs text-white hover:bg-sidebar/90"
            onClick={onEdit}
          >
            Edit Profile
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <ProfileField label="Email Address:" value={profile.email} />
        <ProfileField label="Phone Number:" value={profile.phone_number} />
        <ProfileField label="Password:" value="••••••••" />
      </div>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center border-b border-border/20 pb-4">
      <span className="w-48 text-sm font-semibold text-sidebar">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}

function ProfileEdit({ profile, onDone }: { profile: UserProfile; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState(profile.first_name)
  const [lastName, setLastName] = useState(profile.last_name)
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number)
  const [email, setEmail] = useState(profile.email)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      onDone()
    },
  })

  const photoMutation = useMutation({
    mutationFn: updatePhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
  })

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    },
  })

  return (
    <div className="space-y-8">
      {/* Photo Section */}
      <Section title="Photo">
        <div className="inline-flex flex-col items-start gap-3 rounded-xl bg-muted/30 p-4">
          <span className="text-xs text-muted-foreground">Current Photo</span>
          <div className="size-24 overflow-hidden rounded-xl bg-muted">
            {profile.photo ? (
              <img src={profile.photo} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <svg className="size-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              </div>
            )}
          </div>
          <label>
            <Button
              type="button"
              className="h-8 rounded-full bg-sidebar px-4 text-xs text-white hover:bg-sidebar/90"
              onClick={() => document.getElementById("photo-input")?.click()}
            >
              Update Photo
            </Button>
            <input
              id="photo-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) photoMutation.mutate(file)
              }}
            />
          </label>
        </div>
      </Section>

      {/* Profile Fields */}
      <Section title="Profile">
        <div className="grid grid-cols-2 gap-4">
          <LabeledInput label="First Name" value={firstName} onChange={setFirstName} />
          <LabeledInput label="Last Name" value={lastName} onChange={setLastName} />
          <LabeledInput label="Phone Number" value={phoneNumber} onChange={setPhoneNumber} />
          <LabeledInput label="Email" value={email} onChange={setEmail} disabled />
        </div>
        <Button
          className="mt-4 h-9 rounded-full bg-sidebar px-5 text-xs text-white hover:bg-sidebar/90"
          onClick={() => profileMutation.mutate({ first_name: firstName, last_name: lastName, phone_number: phoneNumber })}
          disabled={profileMutation.isPending}
        >
          {profileMutation.isPending ? "Saving..." : "Update Profile"}
        </Button>
      </Section>

      {/* Authentication */}
      <Section title="Authentication">
        <div className="grid grid-cols-3 gap-4">
          <LabeledInput label="Current Password" type="password" value={currentPassword} onChange={setCurrentPassword} />
          <LabeledInput label="New Password" type="password" value={newPassword} onChange={setNewPassword} />
          <LabeledInput label="Confirm New Password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
        <Button
          className="mt-4 h-9 rounded-full bg-sidebar px-5 text-xs text-white hover:bg-sidebar/90"
          onClick={() => {
            if (newPassword !== confirmPassword) return
            passwordMutation.mutate({ old_password: currentPassword, new_password: newPassword, confirm_new_password: confirmPassword })
          }}
          disabled={passwordMutation.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
        >
          {passwordMutation.isPending ? "Changing..." : "Change password"}
        </Button>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <div className="rounded-2xl border border-border/40 bg-white p-6">
        {children}
      </div>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-10 rounded-lg border-border/60 !bg-white"
      />
    </div>
  )
}

export function ProfilePage() {
  useLogVisit("Profile", "Visited Profile")
  const [editing, setEditing] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  })

  if (isLoading || !profile) {
    return <p className="py-12 text-center text-muted-foreground">Loading profile...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          className="h-11 rounded-lg bg-red-700 px-6 text-white hover:bg-red-800"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 size-4" />
          Log Out
        </Button>
      </div>

      {editing ? (
        <ProfileEdit profile={profile} onDone={() => setEditing(false)} />
      ) : (
        <ProfileView profile={profile} onEdit={() => setEditing(true)} />
      )}
    </div>
  )
}
