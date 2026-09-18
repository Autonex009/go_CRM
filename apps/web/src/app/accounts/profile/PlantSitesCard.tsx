import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  accountsApi,
  type AccountLocation,
  type AccountLocationInput,
} from "../api";
import { ApiError } from "../../lib/api";
import { Alert, Button, Card, CardHeader, Field, Icon } from "../../ui";

/**
 * The company's sites, as the records the deal picker selects from.
 *
 * These were a JSONB array on the profile, saved with the rest of the form.
 * They are rows now (migration 000023) because a deal has to be able to point
 * at one: while they were a blob the deal recorded its site as free text, which
 * is how the same plant came to be spelled three ways across the pipeline.
 *
 * Each edit is its own request rather than part of the profile's Save. A site
 * is referenced by deals the moment it exists, so "added but not saved yet" is
 * a state worth not having — and it matches how the delivery tracker's cells
 * already behave.
 */
export function PlantSitesCard({
  accountId,
  editable,
}: {
  accountId: string;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const query = useQuery({
    queryKey: ["accountLocations", accountId, showArchived],
    queryFn: () => accountsApi.locations(accountId, showArchived),
    enabled: !!accountId,
  });

  // The deal picker reads the un-archived list under its own key, so both have
  // to hear about every write.
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["accountLocations"] });
    void queryClient.invalidateQueries({ queryKey: ["deals"] });
  };

  const settle = (fallback: string) => ({
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : fallback),
  });

  const add = useMutation({
    mutationFn: (name: string) =>
      accountsApi.createLocation(accountId, { name }),
    ...settle("Could not add that site"),
    onSuccess: () => {
      setError(null);
      setDraft("");
      setAdding(false);
      invalidate();
    },
  });

  const save = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AccountLocationInput }) =>
      accountsApi.updateLocation(accountId, id, input),
    ...settle("Could not save that site"),
  });

  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      accountsApi.archiveLocation(accountId, id, archived),
    ...settle("Could not archive that site"),
  });

  const items = query.data ?? [];
  const live = items.filter((l) => !l.archivedAt).length;

  return (
    <Card>
      <CardHeader
        title={`Plant Sites (${live})`}
        action={
          <div className="flex items-center gap-sm">
            <label className="flex items-center gap-xs text-xs text-fg-muted">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
            {editable && (
              <Button
                size="sm"
                variant="secondary"
                icon="plus"
                onClick={() => setAdding(true)}
              >
                Add Site
              </Button>
            )}
          </div>
        }
        className="mb-md"
      />

      {error && (
        <div className="mb-md">
          <Alert>{error}</Alert>
        </div>
      )}

      {query.isPending && <p className="text-sm text-fg-subtle">Loading…</p>}

      {!query.isPending && items.length === 0 && !adding && (
        <p className="text-sm italic text-fg-subtle">
          No sites recorded yet. Add one and it becomes selectable on every deal
          for this company.
        </p>
      )}

      <div className="flex flex-col gap-md">
        {items.map((loc) => (
          <SiteRow
            key={loc.id}
            site={loc}
            editable={editable}
            onSave={(input) => save.mutate({ id: loc.id, input })}
            onArchive={(archived) => archive.mutate({ id: loc.id, archived })}
          />
        ))}
      </div>

      {adding && (
        <div className="mt-md flex flex-wrap items-end gap-sm rounded-md border border-line bg-surface-muted/50 p-sm">
          <div className="min-w-48 flex-1">
            <Field
              label="Site name"
              placeholder="e.g. Taloja Plant"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  e.preventDefault();
                  add.mutate(draft.trim());
                }
              }}
            />
          </div>
          <Button
            size="sm"
            onClick={() => draft.trim() && add.mutate(draft.trim())}
            disabled={!draft.trim() || add.isPending}
          >
            {add.isPending ? "Adding…" : "Add"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAdding(false);
              setDraft("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * One site. The fields commit on blur, so the detail people fill in over weeks
 * — a SPOC's phone number found on a call — is saved the moment it is typed
 * rather than waiting for a form somewhere else to be submitted.
 */
function SiteRow({
  site,
  editable,
  onSave,
  onArchive,
}: {
  site: AccountLocation;
  editable: boolean;
  onSave: (input: AccountLocationInput) => void;
  onArchive: (archived: boolean) => void;
}) {
  const archived = !!site.archivedAt;

  const commit = (field: keyof AccountLocationInput, value: string) => {
    const next = value.trim();
    const current = (site[field] ?? "") as string;
    if (next === current.trim()) return;
    // An emptied name is a delete by accident, and the server would reject it
    // anyway; archiving is how a site goes away.
    if (field === "name" && !next) return;
    onSave({
      name: site.name,
      city: site.city,
      address: site.address,
      spocName: site.spocName,
      spocPhone: site.spocPhone,
      [field]: next || null,
    });
  };

  return (
    <div
      className={`rounded-md border p-sm ${
        archived
          ? "border-dashed border-line bg-surface-muted/40"
          : "border-line bg-surface"
      }`}
    >
      <div className="mb-sm flex items-center justify-between gap-sm">
        <div className="flex min-w-0 items-center gap-sm">
          <Icon name="building" size={14} className="shrink-0 text-fg-subtle" />
          <span className="truncate text-sm font-medium text-fg">
            {site.name}
          </span>
          {archived && (
            <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fg-subtle">
              Archived
            </span>
          )}
          {site.dealCount > 0 && (
            <span
              title="Deals delivering to this site"
              className="shrink-0 text-[11px] text-fg-subtle"
            >
              {site.dealCount} deal{site.dealCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {editable && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              // Named on the button, not in a confirm: archiving is reversible
              // and the count beside it already says what is at stake.
              if (
                archived ||
                site.dealCount === 0 ||
                window.confirm(
                  `Archive ${site.name}? It stays on the ${site.dealCount} deal(s) that already use it, ` +
                    `but will not be offered on new ones.`,
                )
              ) {
                onArchive(!archived);
              }
            }}
          >
            {archived ? "Restore" : "Archive"}
          </Button>
        )}
      </div>

      {editable && !archived && (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <Field
            label="Name"
            defaultValue={site.name}
            onBlur={(e) => commit("name", e.target.value)}
          />
          <Field
            label="City"
            defaultValue={site.city ?? ""}
            onBlur={(e) => commit("city", e.target.value)}
          />
          <Field
            label="Address"
            defaultValue={site.address ?? ""}
            onBlur={(e) => commit("address", e.target.value)}
          />
          <Field
            label="SPOC name"
            defaultValue={site.spocName ?? ""}
            onBlur={(e) => commit("spocName", e.target.value)}
          />
          <Field
            label="SPOC phone"
            defaultValue={site.spocPhone ?? ""}
            onBlur={(e) => commit("spocPhone", e.target.value)}
          />
        </div>
      )}

      {(!editable || archived) && (
        <dl className="grid grid-cols-2 gap-x-md gap-y-xs text-xs">
          {[
            ["City", site.city],
            ["Address", site.address],
            ["SPOC", site.spocName],
            ["Phone", site.spocPhone],
          ]
            .filter(([, v]) => !!v)
            .map(([label, v]) => (
              <div key={label as string}>
                <dt className="text-fg-subtle">{label}</dt>
                <dd className="text-fg">{v}</dd>
              </div>
            ))}
        </dl>
      )}
    </div>
  );
}
