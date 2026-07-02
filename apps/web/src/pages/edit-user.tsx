import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { LabeledInput, LabeledSelect } from "@/components/form-fields"
import { useLogVisit } from "@/hooks/use-log-visit"
import { api } from "@/lib/api"
import { getLGAs } from "@/api/attendance"
import type { AppUser } from "@/types"

const getUser = (id: string) =>
  api.get<AppUser>(`/user/${id}/`).then((response) => response.data)

const updateUser = (id: string, data: Partial<AppUser>) =>
  api.put(`/user/${id}/`, data).then((response) => response.data)

const updateUserPhoto = (id: string, file: File) => {
  const formData = new FormData()
  formData.append("photo", file)
  return api.put(`/user/${id}/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((response) => response.data)
}

const getUserTypes = () =>
  api.get<string[]>("/auth/user-types/").then((response) => response.data)

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

export function EditUserPage() {
  useLogVisit("Manage Users", "Visited Edit User")
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => getUser(id!),
    enabled: !!id,
  })

  const { data: userTypes } = useQuery({
    queryKey: ["user-types"],
    queryFn: getUserTypes,
  })

  const { data: lgaList } = useQuery({
    queryKey: ["lga"],
    queryFn: getLGAs,
  })

  if (isLoading || !user) {
    return <p className="py-12 text-center text-muted-foreground">Loading user...</p>
  }

  return <EditUserForm user={user} userTypes={userTypes} lgaList={lgaList} queryClient={queryClient} navigate={navigate} />
}

function EditUserForm({
  user,
  userTypes,
  lgaList,
  queryClient,
  navigate,
}: {
  user: AppUser
  userTypes: string[] | undefined
  lgaList: { id: number; name: string }[] | undefined
  queryClient: ReturnType<typeof useQueryClient>
  navigate: ReturnType<typeof useNavigate>
}) {
  const [firstName, setFirstName] = useState(user.first_name)
  const [lastName, setLastName] = useState(user.last_name)
  const [phoneNumber, setPhoneNumber] = useState(user.phone_number)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [lga, setLga] = useState(user.lgas.length === 0 ? "ALL LGAs" : user.lgas.join(", "))
  const [activated, setActivated] = useState(user.is_active ? "True" : "False")

  const lgaOptions = ["ALL LGAs", ...(lgaList?.map((item) => item.name) ?? [])]
  const profileMutation = useMutation({
    mutationFn: (data: Partial<AppUser>) => updateUser(String(user.id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", String(user.id)] })
      queryClient.invalidateQueries({ queryKey: ["users"] })
      navigate("/manage-users")
    },
  })

  const photoMutation = useMutation({
    mutationFn: (file: File) => updateUserPhoto(String(user.id), file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", String(user.id)] })
    },
  })

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => navigate("/manage-users")}
          className="flex size-12 items-center justify-center rounded-full bg-foreground text-white hover:bg-foreground/90"
        >
          <ArrowLeft className="size-5" />
        </button>
      </div>

      {/* Photo Section */}
      <Section title="Photo">
        <div className="inline-flex flex-col items-start gap-3 rounded-xl bg-muted/30 p-4">
          <span className="text-xs text-muted-foreground">Current Photo</span>
          <div className="size-24 overflow-hidden rounded-xl bg-muted">
            {user.photo ? (
              <img src={user.photo} alt="" className="size-full object-cover" />
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
              onClick={() => document.getElementById("edit-user-photo-input")?.click()}
            >
              Update Photo
            </Button>
            <input
              id="edit-user-photo-input"
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
          <LabeledSelect
            label="User Type"
            value={role}
            onValueChange={(value) => { if (value) setRole(value) }}
            items={userTypes ?? ["user", "admin", "view_only"]}
            placeholder="Select a user type"
          />
          <LabeledSelect
            label="LGA"
            value={lga}
            onValueChange={(value) => { if (value) setLga(value) }}
            items={lgaOptions}
            placeholder="Select LGA"
          />
          <LabeledSelect
            label="Activated"
            value={activated}
            onValueChange={(value) => { if (value) setActivated(value) }}
            items={["True", "False"]}
            placeholder="Select status"
          />
        </div>
        <Button
          className="mt-6 h-10 rounded-full bg-sidebar px-6 text-sm text-white hover:bg-sidebar/90"
          onClick={() => {
            profileMutation.mutate({
              first_name: firstName,
              last_name: lastName,
              phone_number: phoneNumber,
              role,
              lgas: lga === "ALL LGAs" ? [] : [lga],
              is_active: activated === "True",
            } as Record<string, unknown> as Partial<AppUser>)
          }}
          disabled={profileMutation.isPending || !firstName || !lastName}
        >
          {profileMutation.isPending ? "Saving..." : "Update User"}
        </Button>
      </Section>
    </div>
  )
}
