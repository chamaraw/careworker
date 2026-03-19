"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { createServiceUser } from "./actions";

export function ServiceUserForm({ properties }: { properties: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [careNeedsLevel, setCareNeedsLevel] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    try {
      await createServiceUser({
        name: name.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        address: address.trim() || undefined,
        propertyId: propertyId || null,
        allergies: allergies.trim() || undefined,
        medicalNotes: medicalNotes.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        careNeedsLevel: careNeedsLevel.trim() || undefined,
      });
      router.push("/service-users");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-[48px]"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input
          id="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className="min-h-[48px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="min-h-[48px]"
        />
      </div>
      {properties.length > 0 && (
        <div className="space-y-2">
          <Label>Property</Label>
          <Select value={propertyId} onValueChange={(v) => setPropertyId(v ?? "")}>
            <SelectTrigger className="min-h-[48px]">
              {propertyId ? (
                <span className="truncate">{properties.find((p) => p.id === propertyId)?.name ?? propertyId}</span>
              ) : (
                <span className="text-[var(--muted-foreground)]">None</span>
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="allergies">Allergies</Label>
        <Input
          id="allergies"
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          className="min-h-[48px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="medicalNotes">Medical notes</Label>
        <Textarea
          id="medicalNotes"
          value={medicalNotes}
          onChange={(e) => setMedicalNotes(e.target.value)}
          className="min-h-[100px]"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="emergencyName">Emergency contact name</Label>
          <Input
            id="emergencyName"
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            className="min-h-[48px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyPhone">Emergency contact phone</Label>
          <Input
            id="emergencyPhone"
            type="tel"
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            className="min-h-[48px]"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="careNeedsLevel">Care needs level</Label>
        <Input
          id="careNeedsLevel"
          value={careNeedsLevel}
          onChange={(e) => setCareNeedsLevel(e.target.value)}
          placeholder="e.g. low, medium, high"
          className="min-h-[48px]"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="min-h-[48px]" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Link href="/service-users">
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
