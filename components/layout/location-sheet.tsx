"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Spinner } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { IconLocationPin } from "@/components/ui/topbar-icons";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { useMe } from "@/hooks/use-me";
import { reverseGeocode, useUpdateMe } from "@/features/profile";

/**
 * SETTING YOUR PLACE — the sheet behind the top bar's location pill
 * (node 225:3684's caret).
 *
 * Two fields and nothing else: a city and a region, both free text, both
 * optional. `PATCH /me` takes them with the same semantics every other field on
 * that route has — absent leaves alone, blank clears — so somebody who fills in
 * only a city is not forced to invent a region.
 *
 * ─── "USE MY LOCATION" FILLS THE FIELDS. IT DOES NOT SAVE THEM. ──────────────
 * The button asks the browser for a reading, sends it to `POST /geo/reverse`,
 * and puts the place NAME that comes back into the two boxes. The person then
 * sees "Ikeja" and "Lagos", can edit either, and still has to press Save.
 *
 * That last step is the whole design. The button is a shortcut for TYPING, not
 * a different kind of data: what gets stored is what somebody read and
 * accepted, in words they can see, edit and delete. The coordinates exist for
 * one request, on the server, to ask a provider a question — they are never
 * stored, never returned, and `lib/api/schemas.ts` drops any that arrive.
 *
 * A position that a stranger can turn into a distance is a different product,
 * and it is not this one.
 *
 * The button goes QUIET on a 404 rather than failing in front of somebody: the
 * route is not deployed yet, and the two fields work without it.
 *
 * ─── WHAT IT SAYS OUT LOUD ───────────────────────────────────────────────────
 * The note under the fields tells the reader the two things they would
 * otherwise have to guess: this is public, and it is what the People filters
 * match on. A location control that does not say who can see it is asking for
 * consent it has not obtained.
 */
export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const update = useUpdateMe();
  const [city, setCity] = useState(me.data?.city ?? "");
  const [region, setRegion] = useState(me.data?.region ?? "");
  const [geoUnavailable, setGeoUnavailable] = useState(false);

  const locate = useMutation({
    mutationFn: async () => {
      // The browser's own prompt — refusable, revocable, and not ours to
      // reproduce. `enableHighAccuracy` is deliberately OFF: we are asking for
      // a city, and a coarse fix is faster, cheaper on battery, and less
      // precise about somebody's doorstep.
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("This browser cannot share a location."));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 300_000,
        });
      });
      return reverseGeocode({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    },
    onSuccess: (place) => {
      // A miss is an ANSWER, not an error: the provider did not recognise the
      // spot, so say that and leave the person typing.
      if (!place.city && !place.region) {
        toast("We couldn't name that area — type it in.");
        return;
      }
      if (place.city) setCity(place.city);
      if (place.region) setRegion(place.region);
    },
    onError: (error) => {
      if (errorCode(error) === "NOT_FOUND") {
        setGeoUnavailable(true);
        return;
      }
      // A refused permission is not a failure worth an alarming message — the
      // person said no, and the fields are right there.
      const denied =
        typeof GeolocationPositionError !== "undefined" &&
        error instanceof GeolocationPositionError &&
        error.code === error.PERMISSION_DENIED;
      toast.error(
        denied
          ? "No location shared — you can type it instead."
          : errorMessage(error, "Couldn't work out where you are.")
      );
    },
  });

  const save = () =>
    update.mutate(
      // Blank is sent as blank, not omitted: an omitted field means "leave it",
      // and the reader who emptied the box meant "clear it". The service reads
      // a blank string as a clear, which is the same intent.
      { city: city.trim(), region: region.trim() },
      { onSuccess: onClose }
    );

  return (
    <Sheet open={open} onClose={onClose} title="Your location">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-meta">City</span>
          <input
            autoFocus
            value={city}
            onChange={(event) => setCity(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && save()}
            maxLength={80}
            placeholder="Ikeja"
            className="ws-field w-full px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-white/40"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-meta">State or region</span>
          <input
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && save()}
            maxLength={80}
            placeholder="Lagos"
            className="ws-field w-full px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-white/40"
          />
        </label>

        {!geoUnavailable && (
          <button
            type="button"
            onClick={() => locate.mutate()}
            disabled={locate.isPending}
            className="ws-press flex items-center gap-2 self-start rounded-full bg-white/5 px-3 py-1.5 text-[13px] text-body transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {locate.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <IconLocationPin className="h-4 w-4" />
            )}
            Use my location
          </button>
        )}

        <p className="text-[12px] leading-4 text-meta">
          This is public — it shows on your profile and is what the People filters match on.
          Leave both empty to remove it. We only ever keep the place name, never your
          coordinates.
        </p>

        <Button className="mt-1 w-full" loading={update.isPending} onClick={save}>
          Save
        </Button>
      </div>
    </Sheet>
  );
}
