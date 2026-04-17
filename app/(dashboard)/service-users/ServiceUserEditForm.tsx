"use client";

import { useState, useEffect } from "react";
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
import { updateServiceUser } from "./actions";
import { getPropertyUnitsForSelect } from "@/app/(dashboard)/housing/actions";
import { format } from "date-fns";

type User = {
  id: string;
  name: string;
  dateOfBirth: Date | null;
  address: string | null;
  propertyId: string | null;
  unitId: string | null;
  allergies: string | null;
  medicalNotes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  careNeedsLevel: string | null;
  carePackageId: string | null;
};

export function ServiceUserEditForm({
  user,
  properties,
  carePackages,
}: {
  user: User;
  properties: { id: string; name: string }[];
  carePackages: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [dateOfBirth, setDateOfBirth] = useState(
    user.dateOfBirth ? format(user.dateOfBirth, "yyyy-MM-dd") : ""
  );
  const [address, setAddress] = useState(user.address ?? "");
  const [propertyId, setPropertyId] = useState(user.propertyId ?? "");
  const [unitId, setUnitId] = useState(user.unitId ?? "");
  const [propertyUnits, setPropertyUnits] = useState<
    { id: string; label: string }[]
  >([]);

  useEffect(() => {
    if (!propertyId) {
      setPropertyUnits([]);
      setUnitId("");
      return;
    }
    let cancelled = false;
    getPropertyUnitsForSelect(propertyId).then((units: { id: string; label: string }[]) => {
      if (cancelled) return;
      setPropertyUnits(units);
      setUnitId((cur) => {
        if (!units.length) return cur ? "" : "";
        return cur && units.some((u) => u.id === cur) ? cur : "";
      });
    });
    return () => {
      cancelled = true;
    };
  }, [propertyId]);
  const [allergies, setAllergies] = useState(user.allergies ?? "");
  const [medicalNotes, setMedicalNotes] = useState(user.medicalNotes ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(
    user.emergencyContactName ?? ""
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    user.emergencyContactPhone ?? ""
  );
  const [careNeedsLevel, setCareNeedsLevel] = useState(user.careNeedsLevel ?? "");
  const [carePackageId, setCarePackageId] = useState(user.carePackageId ?? "");
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
      await updateServiceUser(user.id, {
        name: name.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address: address.trim() || "",
        propertyId: propertyId || null,
        unitId: unitId || null,
        allergies: allergies.trim() || "",
        medicalNotes: medicalNotes.trim() || "",
        emergencyContactName: emergencyContactName.trim() || "",
        emergencyContactPhone: emergencyContactPhone.trim() || "",
        careNeedsLevel: careNeedsLevel.trim() || "",
        carePackageId: carePackageId.trim() || null,
      });
      router.push(`/service-users/${user.id}`);
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
          <Select
            value={propertyId}
            onValueChange={(v) => setPropertyId(v ?? "")}
          >
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
      {propertyId && propertyUnits.length > 0 && (
        <div className="space-y-2">
          <Label>Unit (housing)</Label>
          <Select value={unitId} onValueChange={(v) => setUnitId(v ?? "")}>
            <SelectTrigger className="min-h-[48px]">
              {unitId ? (
                <span className="truncate">
                  {propertyUnits.find((u) => u.id === unitId)?.label ?? unitId}
                </span>
              ) : (
                <span className="text-[var(--muted-foreground)]">None</span>
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {propertyUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
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
          className="min-h-[48px]"
        />
      </div>
      {carePackages.length > 0 && (
        <div className="space-y-2">
          <Label>Care package</Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Drives which <strong className="text-slate-800">care package</strong> audit forms appear for this person. Manage links under Audits → Care packages.
          </p>
          <Select value={carePackageId} onValueChange={(v) => setCarePackageId(v ?? "")}>
            <SelectTrigger className="min-h-[48px]">
              {carePackageId ? (
                <span className="truncate">
                  {carePackages.find((p) => p.id === carePackageId)?.name ?? carePackageId}
                </span>
              ) : (
                <span className="text-[var(--muted-foreground)]">None</span>
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {carePackages.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="min-h-[48px]" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Link href={`/service-users/${user.id}`}>
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
