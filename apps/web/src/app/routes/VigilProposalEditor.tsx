import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AccountSelect } from "../accounts/AccountSelect";
import { dealsApi } from "../deals/api";
import { LineItems } from "../documents/LineItems";
import { asTimestamp, emptyDocumentItem } from "../documents/types";
import { ApiError } from "../lib/api";
import { memberLabel, orgApi } from "../org/api";
import { useCurrency } from "../org/workspace";
import { VigilProposalDocument } from "../quotes/VigilProposalDocument";
import { VigilSectionEditor } from "../quotes/VigilSectionEditor";
import {
  isEditable,
  quotesApi,
  type QuoteItemInput,
  type QuoteStatus,
} from "../quotes/api";
import {
  VIGIL_TEMPLATE,
  defaultVigilItems,
  defaultVigilProposal,
  parseVigilProposal,
  type VigilHeader,
  type VigilProposal,
} from "../quotes/vigil";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  PageHeader,
  SelectField,
  Skeleton,
} from "../ui";

/** The linking fields the quote record itself carries. */
interface Links {
  accountId: string;
  dealId: string;
  ownerUserId: string;
  validUntil: string;
}

/**
 * The VIGIL techno-commercial proposal editor.
 *
 * A route of its own rather than a mode inside QuoteEditor: the two documents
 * share a record and almost nothing else on screen. A plain quote is a header
 * and a price grid; this is twenty-odd narrative sections with the same price
 * grid inside it, and folding both into one component would have meant a
 * five-hundred-line file where every block was behind a conditional.
 *
 * What they do share is the money. The commercials here are ordinary quote line
 * items, so the total on the quotes list, the company financials and any invoice
 * raised later all read the same numbers.
 */
export default function VigilProposalEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceCurrency = useCurrency();

  const [links, setLinks] = useState<Links>({
    accountId: "",
    dealId: "",
    ownerUserId: "",
    validUntil: "",
  });
  const [items, setItems] = useState<QuoteItemInput[]>(defaultVigilItems);
  const [proposal, setProposal] = useState<VigilProposal>(defaultVigilProposal);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["quote", id],
    queryFn: () => quotesApi.get(id!),
    enabled: !isNew,
  });

  const quote = query.data;
  const status: QuoteStatus = quote?.status ?? "draft";
  const editable = isNew || isEditable(status);
  const currency = quote?.currency ?? workspaceCurrency;

  // Hydrate once the document arrives. `dirty` stops a background refetch
  // overwriting edits in progress.
  useEffect(() => {
    if (!quote || dirty) return;
    setLinks({
      accountId: quote.accountId ?? "",
      dealId: quote.dealId ?? "",
      ownerUserId: quote.ownerUserId ?? "",
      validUntil: quote.validUntil?.slice(0, 10) ?? "",
    });
    setItems(
      quote.items?.length
        ? quote.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discountPercent: i.discountPercent,
            taxPercent: i.taxPercent,
          }))
        : defaultVigilItems(),
    );
    setProposal(parseVigilProposal(quote.proposal));
  }, [quote, dirty]);

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });
  const deals = useQuery({
    queryKey: ["deals"],
    queryFn: dealsApi.board,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        accountId: links.accountId || undefined,
        dealId: links.dealId || undefined,
        ownerUserId: links.ownerUserId || undefined,
        validUntil: asTimestamp(links.validUntil),
        items,
        template: VIGIL_TEMPLATE,
        proposal,
      };
      return isNew
        ? quotesApi.create(payload)
        : quotesApi.update(id!, payload);
    },
    onSuccess: (saved) => {
      setDirty(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      void queryClient.invalidateQueries({ queryKey: ["quote", saved.id] });
      if (isNew) navigate(`/quotes/${saved.id}/proposal`, { replace: true });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : "Could not save the proposal",
      ),
  });

  const patchHeader = useCallback((patch: Partial<VigilHeader>) => {
    setDirty(true);
    setProposal((prev) => ({ ...prev, header: { ...prev.header, ...patch } }));
  }, []);

  const patchItem = useCallback(
    (index: number, patch: Partial<QuoteItemInput>) => {
      setDirty(true);
      setItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const removeItem = useCallback((index: number) => {
    setDirty(true);
    // Never leave the grid empty — an editor with no rows has no affordance.
    setItems((prev) =>
      prev.length === 1 ? [emptyDocumentItem()] : prev.filter((_, i) => i !== index),
    );
  }, []);

  /**
   * Applying the camera count to every line.
   *
   * The whole document is priced per camera, so the count in the header and the
   * quantity on each commercial line are the same number said twice. Rather than
   * silently coupling them — which would fight anyone quoting a one-off item —
   * this is an explicit action the user takes.
   */
  const cameras = Number(proposal.header.cameraCount);
  const applyCameraCount = useCallback(() => {
    if (!Number.isFinite(cameras) || cameras <= 0) return;
    setDirty(true);
    setItems((prev) => prev.map((item) => ({ ...item, quantity: cameras })));
  }, [cameras]);

  const quantitiesMatch = useMemo(
    () => items.every((i) => i.quantity === cameras),
    [items, cameras],
  );

  if (!isNew && query.isPending) {
    return (
      <div className="flex flex-col gap-lg">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isNew && (query.isError || !quote)) {
    return (
      <div className="flex flex-col gap-md">
        <Alert>
          {query.error instanceof ApiError
            ? query.error.message
            : "Proposal not found"}
        </Alert>
        <Button variant="secondary" onClick={() => navigate("/quotes")}>
          Back to quotes
        </Button>
      </div>
    );
  }

  if (preview && quote) {
    return (
      <div className="flex flex-col gap-md">
        <div className="no-print flex flex-wrap items-center justify-between gap-sm">
          <Button variant="secondary" size="sm" onClick={() => setPreview(false)}>
            Back to editing
          </Button>
          <Button size="sm" icon="printer" onClick={() => window.print()}>
            Print / save as PDF
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-neutral-200 p-md print:border-0 print:bg-white print:p-0">
          <VigilProposalDocument quote={quote} proposal={proposal} />
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title={isNew ? "New VIGIL proposal" : "VIGIL proposal"}
        subtitle={
          quote
            ? `${quote.number} · ${proposal.header.customerName || "Unnamed customer"}`
            : "Techno-commercial proposal — VIGIL industrial vision monitoring"
        }
        action={
          <div className="flex flex-wrap items-center gap-sm">
            {!isNew && <Badge tone="neutral">{status}</Badge>}
            {!isNew && (
              <Button
                variant="secondary"
                size="sm"
                icon="printer"
                onClick={() => setPreview(true)}
              >
                Preview & print
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={!editable || save.isPending}
            >
              {save.isPending ? "Saving..." : "Save proposal"}
            </Button>
          </div>
        }
      />

      {error && <Alert>{error}</Alert>}
      {!editable && (
        <Alert tone="warning">
          This proposal has been issued. Revise it back to draft from the quote
          page to make changes.
        </Alert>
      )}

      {/* Who it is for, and what it is attached to in the CRM. */}
      <Card>
        <CardHeader
          title="Proposal header"
          subtitle="Printed on page one of the document"
          className="mb-md"
        />
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Customer name"
            value={proposal.header.customerName}
            disabled={!editable}
            onChange={(e) => patchHeader({ customerName: e.target.value })}
          />
          <Field
            label="Plant / site name & location"
            value={proposal.header.siteName}
            disabled={!editable}
            onChange={(e) => patchHeader({ siteName: e.target.value })}
          />
          <Field
            label="Quotation number"
            value={proposal.header.quotationNumber}
            disabled={!editable}
            onChange={(e) => patchHeader({ quotationNumber: e.target.value })}
          />
          <Field
            label="Date"
            type="date"
            value={proposal.header.proposalDate}
            disabled={!editable}
            onChange={(e) => patchHeader({ proposalDate: e.target.value })}
          />
          <Field
            label="Validity (days)"
            type="number"
            value={proposal.header.validityDays}
            disabled={!editable}
            onChange={(e) => patchHeader({ validityDays: e.target.value })}
          />
          <Field
            label="Cameras in scope"
            type="number"
            value={proposal.header.cameraCount}
            disabled={!editable}
            onChange={(e) => patchHeader({ cameraCount: e.target.value })}
          />
          <Field
            label="Prepared by"
            value={proposal.header.preparedBy}
            disabled={!editable}
            onChange={(e) => patchHeader({ preparedBy: e.target.value })}
          />
          <Field
            label="Version"
            value={proposal.header.version}
            disabled={!editable}
            onChange={(e) => patchHeader({ version: e.target.value })}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="CRM links"
          subtitle="Where this proposal files itself — company, deal, owner"
          className="mb-md"
        />
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
          <AccountSelect
            value={links.accountId}
            disabled={!editable}
            onChange={(e) => {
              setDirty(true);
              setLinks((p) => ({ ...p, accountId: e.target.value }));
            }}
          />
          <SelectField
            label="Deal"
            value={links.dealId}
            disabled={!editable}
            onChange={(e) => {
              setDirty(true);
              setLinks((p) => ({ ...p, dealId: e.target.value }));
            }}
          >
            <option value="">—</option>
            {(deals.data?.deals ?? []).map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.title}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Owner"
            value={links.ownerUserId}
            disabled={!editable}
            onChange={(e) => {
              setDirty(true);
              setLinks((p) => ({ ...p, ownerUserId: e.target.value }));
            }}
          >
            <option value="">—</option>
            {(members.data ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {memberLabel(member)}
              </option>
            ))}
          </SelectField>
          <Field
            label="Valid until"
            type="date"
            value={links.validUntil}
            disabled={!editable}
            onChange={(e) => {
              setDirty(true);
              setLinks((p) => ({ ...p, validUntil: e.target.value }));
            }}
          />
        </div>
      </Card>

      {/* The money. Ordinary quote line items, priced per camera. */}
      <Card>
        <CardHeader
          title="Commercials"
          subtitle="Priced per camera. These are the quote's line items, so the totals here are the totals everywhere."
          action={
            editable && (
              <div className="flex items-center gap-sm">
                {cameras > 0 && !quantitiesMatch && (
                  <Button size="sm" variant="secondary" onClick={applyCameraCount}>
                    Set all quantities to {cameras}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  icon="plus"
                  onClick={() => {
                    setDirty(true);
                    setItems((prev) => [...prev, emptyDocumentItem()]);
                  }}
                >
                  Add line
                </Button>
              </div>
            )
          }
          className="mb-md"
        />
        <LineItems
          items={items}
          currency={currency}
          readOnly={!editable}
          onChange={patchItem}
          onRemove={removeItem}
        />
        <textarea
          rows={2}
          disabled={!editable}
          className="mt-md w-full rounded-md border border-line bg-surface p-sm text-xs text-fg"
          value={proposal.commercialsNote}
          aria-label="Commercials footnote"
          onChange={(e) => {
            setDirty(true);
            setProposal((p) => ({ ...p, commercialsNote: e.target.value }));
          }}
        />
      </Card>

      {/* The document body. Pre-filled from the standard template; all editable. */}
      <div className="flex items-center justify-between gap-md">
        <h2 className="text-sm font-semibold text-fg">
          Proposal sections ({proposal.sections.length})
        </h2>
      </div>

      {proposal.sections.map((section, index) => (
        <VigilSectionEditor
          key={section.id}
          section={section}
          onChange={(next) => {
            setDirty(true);
            setProposal((p) => ({
              ...p,
              sections: p.sections.map((s, i) => (i === index ? next : s)),
            }));
          }}
          onRemove={() => {
            setDirty(true);
            setProposal((p) => ({
              ...p,
              sections: p.sections.filter((_, i) => i !== index),
            }));
          }}
        />
      ))}

      <div className="flex justify-end gap-sm pb-xl">
        <Button variant="secondary" onClick={() => navigate("/quotes")}>
          Back to quotes
        </Button>
        <Button onClick={() => save.mutate()} disabled={!editable || save.isPending}>
          {save.isPending ? "Saving..." : "Save proposal"}
        </Button>
      </div>
    </section>
  );
}
