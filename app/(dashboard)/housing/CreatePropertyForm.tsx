"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createProperty } from "./actions";

export function CreatePropertyForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [communal, setCommunal] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    try {
      await createProperty({
        name,
        addressLine1: addressLine1 || undefined,
        city: city || undefined,
        postcode: postcode || undefined,
        communalAreasNotes: communal || undefined,
      });
      setName("");
      setAddressLine1("");
      setCity("");
      setPostcode("");
      setCommunal("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add property</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[48px]"
              placeholder="e.g. Oak House"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-line1">Address line</Label>
              <Input
                id="p-line1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="min-h-[48px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-city">City</Label>
              <Input
                id="p-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="min-h-[48px]"
              />
            </div>
          </div>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="p-post">Postcode</Label>
            <Input
              id="p-post"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              className="min-h-[48px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-communal">Communal areas &amp; access notes</Label>
            <Textarea
              id="p-communal"
              value={communal}
              onChange={(e) => setCommunal(e.target.value)}
              rows={3}
              placeholder="Stairwells, shared gardens, key safes, H&S context…"
            />
          </div>
          <Button type="submit" disabled={pending} className="min-h-[44px]">
            {pending ? "Saving…" : "Create property"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
