import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useLogVisit } from "@/hooks/use-log-visit"
import { api } from "@/lib/api"
import { getLGAs } from "@/api/attendance"

const getUserTypes = () =>
  api.get<string[]>("/auth/user-types/").then((response) => response.data)

const createUser = (data: {
  first_name: string
  last_name: string
  phone_number: string
  email: string
  role: string
  lga_ids: number[]
  is_active: boolean
  password: string
}) => api.post("/user/", data).then((response) => response.data)

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border-border/60 !bg-white"
      />
    </div>
  )
}

function LabeledSelect({
  label,
  value,
  onValueChange,
  items,
  placeholder,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  items: string[]
  placeholder: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger className="h-11 w-full rounded-lg border-border/60 !bg-white px-3">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function NewUserPage() {
  useLogVisit("Manage Users", "Visited New User")
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [email, setEmail] = useState("")
  const [userType, setUserType] = useState("User")
  const [lga, setLga] = useState("ALL LGAs")
  const [activated, setActivated] = useState("True")
  const [password, setPassword] = useState("")

  const { data: userTypes } = useQuery({
    queryKey: ["user-types"],
    queryFn: getUserTypes,
  })

  const { data: lgaList } = useQuery({
    queryKey: ["lga"],
    queryFn: getLGAs,
  })

  const lgaOptions = ["ALL LGAs", ...(lgaList?.map((item) => item.name) ?? [])]
  const lgaIdMap = new Map(lgaList?.map((item) => [item.name, item.id]) ?? [])

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => navigate("/manage-users"),
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

      {/* Form */}
      <div className="rounded-2xl border border-border/40 bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <LabeledInput label="First Name" value={firstName} onChange={setFirstName} />
          <LabeledInput label="Last Name" value={lastName} onChange={setLastName} />
          <LabeledInput label="Phone Number" value={phoneNumber} onChange={setPhoneNumber} />
          <LabeledInput label="Email" value={email} onChange={setEmail} />
          <LabeledSelect
            label="User Type"
            value={userType}
            onValueChange={setUserType}
            items={userTypes ?? ["User", "Admin", "View Only"]}
            placeholder="Select a user type"
          />
          <LabeledSelect
            label="LGA"
            value={lga}
            onValueChange={setLga}
            items={lgaOptions}
            placeholder="Select LGA"
          />
          <LabeledSelect
            label="Activated"
            value={activated}
            onValueChange={setActivated}
            items={["True", "False"]}
            placeholder="Select status"
          />
          <LabeledInput label="Password" value={password} onChange={setPassword} type="password" />
        </div>
        <Button
          className="mt-6 h-10 rounded-full bg-sidebar px-6 text-sm text-white hover:bg-sidebar/90"
          onClick={() => {
            const selectedLgaId = lgaIdMap.get(lga)
            mutation.mutate({
              first_name: firstName,
              last_name: lastName,
              phone_number: phoneNumber,
              email,
              role: userType.toLowerCase(),
              lga_ids: selectedLgaId ? [selectedLgaId] : [],
              is_active: activated === "True",
              password,
            })
          }}
          disabled={mutation.isPending || !firstName || !lastName || !email || !password}
        >
          {mutation.isPending ? "Creating..." : "Create User"}
        </Button>
      </div>
    </div>
  )
}
