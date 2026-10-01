"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  Search,
  Play,
  Newspaper,
} from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { experience } from "@/lib/i18n/experience";
import { interfaceText } from "@/lib/i18n/interface";
import {
  resourceKinds,
  type ResourceInput,
  type ResourceItem,
  type ResourceKind,
} from "@/lib/resources/types";
export function ResourceLibrary({
  admin = false,
  doctor = false,
}: {
  admin?: boolean;
  doctor?: boolean;
}) {
  const { lang } = useT();
  return <Library key={lang} admin={admin} doctor={doctor} />;
}
function Library({ admin, doctor }: { admin: boolean; doctor: boolean }) {
  const { lang } = useT();
  const x = (key: Parameters<typeof experience>[1]) => experience(lang, key);
  const u = (key: Parameters<typeof interfaceText>[1]) =>
    interfaceText(lang, key);
  const reviewer = admin || doctor;
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [results, setResults] = useState<ResourceInput[] | null>(null);
  const [filter, setFilter] = useState<ResourceKind | "all">("all");
  const [kind, setKind] = useState<ResourceKind>("article");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    fetch(
      `${reviewer ? "/api/admin/resources" : "/api/resources"}?language=${lang}`,
      { signal: abort.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        setItems((await r.json()).resources);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [reviewer, lang]);
  async function search(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    setDisabled(false);
    try {
      const r = await fetch("/api/admin/resources/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, kind, language: lang }),
      });
      if (!r.ok) throw Error();
      const data = await r.json();
      setDisabled(data.enabled === false);
      setResults(data.results);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function save(resource: ResourceInput) {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resource),
      });
      if (!r.ok) throw Error();
      const data = await r.json();
      setItems((old) => [data.resource, ...old]);
      setSaved((old) => [...old, resource.url]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function decide(id: string, status: ResourceItem["status"]) {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch(`/api/admin/resources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          version: items.find((i) => i.id === id)?.version,
        }),
      });
      if (!r.ok) throw Error();
      const data = await r.json();
      setItems((old) => old.map((i) => (i.id === id ? data.resource : i)));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const resource = {
      ...editing,
      title: String(form.get("title")),
      description: String(form.get("description")),
      url: String(form.get("url")),
      imageUrl: String(form.get("imageUrl") || "") || null,
    };
    setBusy(true);
    setError(false);
    try {
      const r = await fetch(`/api/admin/resources/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, version: editing.version }),
      });
      if (!r.ok) throw Error();
      const data = await r.json();
      setItems((old) =>
        old.map((i) => (i.id === editing.id ? data.resource : i)),
      );
      setEditing(null);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: ResourceItem) {
    if (!window.confirm(u("confirmDelete"))) return;
    setBusy(true);
    setError(false);
    try {
      const r = await fetch(`/api/admin/resources/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: item.version }),
      });
      if (!r.ok) throw Error();
      setItems((old) => old.filter((i) => i.id !== item.id));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  function card(
    item: ResourceInput & Partial<ResourceItem>,
    index: number,
    discovery = false,
  ) {
    const Icon =
      item.kind === "video"
        ? Play
        : item.kind === "news"
          ? Newspaper
          : BookOpen;
    return (
      <article
        className="resource-card"
        key={item.id ?? `${item.url}-${index}`}
      >
        <div className="resource-card-media">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Icon size={35} strokeWidth={1} />
          )}
        </div>
        <div className="resource-card-body">
          <div className="resource-meta">
            <span className="pill">
              <Icon size={11} />
              {x(item.kind)}
            </span>
            <span>{new URL(item.url).hostname.replace(/^www\./, "")}</span>
          </div>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          {item.status === "approved" && (
            <span className="pill self-start">
              <CheckCheck size={12} />
              {x("approved")}
            </span>
          )}
          {reviewer && item.status && item.status !== "approved" && (
            <span className="pill self-start">{x(item.status)}</span>
          )}
          <a
            className="resource-link"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {x("read")}
            <ArrowUpRight size={16} />
          </a>
          {reviewer && (
            <div className="resource-actions">
              {discovery ? (
                <button
                  disabled={busy || saved.includes(item.url)}
                  className="button button-secondary"
                  onClick={() => save(item)}
                >
                  {x(saved.includes(item.url) ? "saved" : "saveReview")}
                </button>
              ) : (
                <>
                  <p className="text-xs">
                    {u("doctorReview")}:{" "}
                    {x(item.doctorApprovedBy ? "approved" : "pending")} ·{" "}
                    {u("adminReview")}:{" "}
                    {x(item.approvedBy ? "approved" : "pending")}
                  </p>
                  {!(doctor ? item.doctorApprovedBy : item.approvedBy) && (
                    <button
                      disabled={busy}
                      className="button button-primary"
                      onClick={() => decide(item.id!, "approved")}
                    >
                      {x("approve")}
                    </button>
                  )}
                  <button
                    disabled={busy}
                    className="button button-secondary"
                    onClick={() =>
                      decide(
                        item.id!,
                        item.status === "approved" ? "pending" : "rejected",
                      )
                    }
                  >
                    {x(item.status === "approved" ? "unpublish" : "reject")}
                  </button>
                  <button
                    disabled={busy}
                    className="button button-secondary"
                    onClick={() => setEditing(item as ResourceItem)}
                  >
                    {u("edit")}
                  </button>
                  {admin && (
                    <button
                      disabled={busy}
                      className="button button-secondary"
                      onClick={() => remove(item as ResourceItem)}
                    >
                      {u("remove")}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </article>
    );
  }
  const filtered = items.filter((i) => filter === "all" || i.kind === filter);
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{x(admin ? "curate" : "resources")}</span>
          <h1>{x("resources")}</h1>
          <p>{reviewer ? u("reviewNote") : x("libraryIntro")}</p>
        </div>
        <BookOpen size={28} strokeWidth={1.3} />
      </div>
      {editing && (
        <section className="panel resource-editor">
          <h2>{u("edit")}</h2>
          <form onSubmit={update}>
            {(["title", "description", "url", "imageUrl"] as const).map(
              (key) => (
                <label key={key}>
                  {u(
                    key === "url" ? "link" : key === "imageUrl" ? "image" : key,
                  )}
                  {key === "description" ? (
                    <textarea
                      className="field w-full"
                      name={key}
                      defaultValue={editing[key]}
                      maxLength={1200}
                    />
                  ) : (
                    <input
                      className="field w-full"
                      name={key}
                      defaultValue={editing[key] ?? ""}
                      required={key !== "imageUrl"}
                      type={key === "title" ? "text" : "url"}
                    />
                  )}
                </label>
              ),
            )}
            <div className="flex gap-2">
              <button disabled={busy} className="button button-primary">
                {u("save")}
              </button>
              <button
                type="button"
                disabled={busy}
                className="button button-secondary"
                onClick={() => setEditing(null)}
              >
                {u("cancel")}
              </button>
            </div>
          </form>
        </section>
      )}
      {admin && (
        <section className="panel">
          <h2>{x("discover")}</h2>
          <form className="resource-search" onSubmit={search}>
            <label className="sr-only" htmlFor="resource-query">
              {x("search")}
            </label>
            <input
              className="field"
              id="resource-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={x("searchHint")}
              minLength={2}
              maxLength={200}
              required
            />
            <select
              className="field"
              aria-label={x("all")}
              value={kind}
              onChange={(e) => setKind(e.target.value as ResourceKind)}
            >
              {resourceKinds.map((k) => (
                <option key={k} value={k}>
                  {x(k)}
                </option>
              ))}
            </select>
            <button disabled={busy} className="button button-primary">
              <Search size={16} />
              {x(busy ? "loading" : "search")}
            </button>
          </form>
          {disabled && <p className="notice">{x("notConfigured")}</p>}
          {results && (
            <div className="resource-grid resource-results">
              {results.map((i, n) => card(i, n, true))}
              {!results.length && !disabled && <p>{x("noResults")}</p>}
            </div>
          )}
        </section>
      )}
      {error && (
        <p role="alert" className="notice emergency mt-4">
          {x("error")}
        </p>
      )}
      <div className="filter-tabs">
        {(["all", ...resourceKinds] as const).map((k) => (
          <button
            key={k}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            {x(k === "all" ? "all" : k)}
          </button>
        ))}
      </div>
      {loading ? (
        <p role="status">{x("loading")}</p>
      ) : filtered.length ? (
        <div className="resource-grid">
          {filtered.map((i, n) => card(i, n))}
        </div>
      ) : (
        <div className="empty-state">
          <BookOpen size={32} />
          <p>{x(admin ? "empty" : "libraryEmpty")}</p>
        </div>
      )}
    </div>
  );
}
