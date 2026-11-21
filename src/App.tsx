import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { ApiError, createProduct, createProduction, getCategories, getProductions, getProducts, getWorkGroups, updateProductAppearance } from "./services/api";
import type { Category, Product, Production, WorkGroup } from "./types/api";

const pages = [
  { name: "Inicio", icon: "home" },
  { name: "Historial", icon: "history" },
  { name: "Estadísticas", icon: "statistics" },
  { name: "Sabores", icon: "flavors" },
] as const;

type Page = (typeof pages)[number]["name"];
type IconName = (typeof pages)[number]["icon"] | "plus" | "arrow" | "close" | "refresh" | "calendar" | "search" | "switch" | "check" | "edit";

const icons: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
  history: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2m6 2V2M9 9h6m-6 4h6m-6 4h4"/></>,
  statistics: <path d="M4 4v16h16M8 16v-3m5 3V9m5 7V6"/>,
  flavors: <><path d="M5.5 11a6.5 6.5 0 0 1 13 0H5.5ZM7 11l5 10 5-10"/><path d="M9 14h6"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  arrow: <path d="m9 18 6-6-6-6"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  refresh: <><path d="M20 8a8 8 0 0 0-14-2L3 9m0 0h5M3 9V4m1 12a8 8 0 0 0 14 2l3-3m0 0h-5m5 0v5"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></>,
  switch: <path d="M4 8h16m-4-4 4 4-4 4m4 4H4m4-4-4 4 4 4"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  edit: <><path d="m14 5 5 5M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/></>,
};

const flavorIcons = [
  ["🌿", "Menta"], ["🍦", "Helado"], ["🍧", "Cremolada"], ["🍓", "Fresa"],
  ["🥭", "Mango"], ["🍍", "Piña"], ["🍋", "Limón"], ["🍇", "Uva"],
  ["🥥", "Coco"], ["🍪", "Galleta"], ["🍫", "Chocolate"], ["🟠", "Maracuyá"], ["🟤", "Lúcuma"],
] as const;
const defaultFlavorColor = "#ad7055";
const timeZone = "America/Lima";
const monthKey = new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit" });
const monthLabel = new Intl.DateTimeFormat("es-PE", { timeZone, year: "numeric", month: "long" });
const dayLabel = new Intl.DateTimeFormat("es-PE", { timeZone, weekday: "long", day: "numeric", month: "long" });
const historyDay = new Intl.DateTimeFormat("es-PE", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const historyHour = new Intl.DateTimeFormat("es-PE", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const numberLabel = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });
const percentLabel = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 1 });

type DatedProduction = { record: Production; date: Date | null };
type HistoryFlavor = { id: number; name: string };
type OpenDialog = { kind: "register" } | { kind: "flavor"; product?: Product };

function orderProductions(records: Production[]): DatedProduction[] {
  return records.map((record) => {
    const value = record.producedAt;
    const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + "Z");
    return { record, date: Number.isNaN(date.getTime()) ? null : date };
  }).sort((first, second) => {
    const firstTime = first.date?.getTime() ?? -Infinity;
    const secondTime = second.date?.getTime() ?? -Infinity;
    return firstTime === secondTime ? second.record.id - first.record.id : secondTime - firstTime;
  });
}

function safeFlavorColor(color?: string | null) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : defaultFlavorColor;
}

function flavorStyle(color?: string | null): CSSProperties {
  return { "--flavor": safeFlavorColor(color) } as CSSProperties;
}

function groupProducts(products: Product[]) {
  const categories = new Map<string, Product[]>();
  for (const product of products) {
    const category = product.categoryName || "Otros sabores";
    const items = categories.get(category);
    if (items) items.push(product);
    else categories.set(category, [product]);
  }
  return categories;
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function FlavorMark({ emoji, color }: { emoji?: string | null; color?: string | null }) {
  return <span className="flavor-mark" style={flavorStyle(color)} aria-hidden="true">{emoji || <Icon name="flavors" />}</span>;
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><Icon name="flavors" /></span><div><span>Dulcería</span><strong>El Primo</strong></div></div>;
}

function GroupBadge({ group }: { group: WorkGroup }) {
  return (
    <span className="group-badge" aria-hidden="true">
      {group.members.slice(0, 3).map((member) => (
        <span key={member.id} style={flavorStyle(member.color)}>{member.name.trim().slice(0, 1).toUpperCase()}</span>
      ))}
    </span>
  );
}

function HistoryList({ records, empty }: { records: DatedProduction[]; empty: string }) {
  if (records.length === 0) return <p className="empty-state">{empty}</p>;

  const byDay = new Map<string, DatedProduction[]>();
  for (const item of records) {
    const day = item.date ? historyDay.format(item.date) : "Fecha sin confirmar";
    const items = byDay.get(day);
    if (items) items.push(item);
    else byDay.set(day, [item]);
  }

  return (
    <ul className="history-days">
      {[...byDay].map(([day, items]) => (
        <li key={day}>
          <h3 className="history-day-heading">{day}</h3>
          <ul className="history-list">
            {items.map(({ record, date }) => (
              <li key={record.id} className="history-row">
                <FlavorMark emoji={record.productEmoji} color={record.productColor} />
                <div className="history-name"><strong>{record.productName}</strong><span>{record.workGroupName}</span></div>
                {date ? <time className="record-hour" dateTime={date.toISOString()}>{historyHour.format(date)}</time> : <span className="record-hour">—</span>}
                <span className="point-tag">+{numberLabel.format(record.points)} {record.points === 1 ? "punto" : "puntos"}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function FlavorStatistics({ records, empty, onViewHistory }: {
  records: DatedProduction[];
  empty: string;
  onViewHistory: (flavor: HistoryFlavor) => void;
}) {
  const byFlavor = new Map<number, { record: Production; count: number }>();
  for (const { record } of records) {
    const flavor = byFlavor.get(record.productId);
    if (flavor) flavor.count += 1;
    else byFlavor.set(record.productId, { record, count: 1 });
  }
  const flavors = [...byFlavor.values()].sort((first, second) =>
    second.count - first.count || first.record.productName.localeCompare(second.record.productName, "es-PE")
  );
  const first = flavors[0];
  const leaders = first ? flavors.filter((flavor) => flavor.count === first.count).length : 0;

  return (
    <>
      <dl className="stats-totals">
        <div className="stat-total">
          <dt>Preparaciones</dt>
          <dd>{numberLabel.format(records.length)}</dd>
        </div>
        <div className="stat-total">
          <dt>Sabores preparados</dt>
          <dd>{numberLabel.format(flavors.length)}</dd>
        </div>
        {first && (
          <div className="stat-total stat-featured">
            <dt>{leaders > 1 ? "Empate en primer lugar" : "Sabor más preparado"}</dt>
            <dd>
              {leaders > 1 ? numberLabel.format(leaders) + " sabores" : first.record.productName}
              <small>{numberLabel.format(first.count)} {first.count === 1 ? "preparación" : "preparaciones"}{leaders > 1 ? " por sabor" : ""}</small>
            </dd>
          </div>
        )}
      </dl>
      <section className="panel">
        <div className="panel-heading"><h2>Preparaciones por sabor</h2></div>
        {flavors.length === 0 ? <p className="empty-state">{empty}</p> : (
          <ol className="flavor-stats">
            {flavors.map(({ record, count }) => {
              const share = count / records.length;
              return (
                <li key={record.productId} className="flavor-stat">
                  <FlavorMark emoji={record.productEmoji} color={record.productColor} />
                  <div className="flavor-stat-main">
                    <button type="button" className="text-button" aria-label={"Ver registros de " + record.productName}
                      onClick={() => onViewHistory({ id: record.productId, name: record.productName })}>
                      {record.productName}<Icon name="arrow" />
                    </button>
                    <div className="flavor-stat-track" aria-hidden="true">
                      <span style={{ ...flavorStyle(record.productColor), width: share * 100 + "%" }} />
                    </div>
                  </div>
                  <div className="flavor-stat-value">
                    <strong>{numberLabel.format(count)} {count === 1 ? "preparación" : "preparaciones"}</strong>
                    <small>{percentLabel.format(share)} del total</small>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}

function FormDialog({ title, titleId, saving, onDismiss, onSubmit, children, footer, compact = false }: {
  title: string;
  titleId: string;
  saving: boolean;
  onDismiss: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  footer: ReactNode;
  compact?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={compact ? "register-dialog flavor-dialog" : "register-dialog"}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!saving) onDismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !saving) onDismiss(); }}
    >
      <form className="register-form" onSubmit={onSubmit}>
        <header className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={onDismiss} aria-label="Cerrar formulario" disabled={saving}><Icon name="close" /></button>
        </header>
        <div className="dialog-body">{children}</div>
        <footer className="dialog-footer">{footer}</footer>
      </form>
    </dialog>
  );
}

function FlavorDialog({ product, onDismiss, onSaved }: {
  product?: Product;
  onDismiss: () => void;
  onSaved: (product: Product) => void;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoriesError, setCategoriesError] = useState(false);
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [emoji, setEmoji] = useState(product?.emoji || "");
  const [color, setColor] = useState(product?.color || "");
  const trimmedName = name.trim();
  const selectedCategory = categories?.find((category) => String(category.id) === categoryId);
  const canSave = Boolean(product) || (trimmedName.length > 0 && trimmedName.length <= 100 && selectedCategory !== undefined);
  const previousIcon = product?.emoji;

  useEffect(() => {
    if (product) return;
    const controller = new AbortController();
    getCategories(controller.signal)
      .then((available) => {
        if (!controller.signal.aborted) setCategories(available);
      })
      .catch(() => { if (!controller.signal.aborted) setCategoriesError(true); });
    return () => controller.abort();
  }, [categoryAttempt, product]);

  function reloadCategories() {
    setCategoryId("");
    setCategories(null);
    setCategoriesError(false);
    setCategoryAttempt((attempt) => attempt + 1);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || saving) return;

    setSaving(true);
    setError("");
    try {
      const appearance = { emoji: emoji || null, color: color || null };
      if (product) {
        onSaved(await updateProductAppearance(product.id, appearance));
      } else if (selectedCategory) {
        onSaved(await createProduct({ name: trimmedName, categoryId: selectedCategory.id, ...appearance }));
      }
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "BUSINESS_ERROR") {
        setError("Ya existe un sabor con ese nombre.");
      } else if (!product && failure instanceof ApiError && failure.status === 404) {
        setError("Esa categoría ya no está disponible. Elige otra.");
        reloadCategories();
      } else {
        setError("No pudimos confirmar el guardado. Recarga la página y revisa Sabores antes de volver a intentarlo.");
      }
      setSaving(false);
    }
  }

  return (
    <FormDialog title={product ? "Editar apariencia" : "Nuevo sabor"} titleId="flavor-title" saving={saving} onDismiss={onDismiss} onSubmit={save} compact
      footer={
        <>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button type="submit" className="button primary" disabled={!canSave || saving}>
            <Icon name="check" /> {saving ? "Guardando…" : product ? "Guardar cambios" : "Guardar sabor"}
          </button>
        </>
      }>
      <fieldset className="flavor-fields" disabled={saving}>
        {!product && (
          <>
            <label>
              Nombre del sabor
              <input type="text" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Helado de menta" />
            </label>
            <label>
              Categoría
              <select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!categories?.length}>
                <option value="">Selecciona una categoría</option>
                {categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {!categories && !categoriesError && <p className="muted" role="status">Cargando categorías…</p>}
            {categoriesError && (
              <div className="category-feedback" role="alert">
                <p>No pudimos cargar las categorías.</p>
                <button type="button" className="text-button" onClick={reloadCategories}>Reintentar</button>
              </div>
            )}
            {categories?.length === 0 && <p className="muted">Todavía no hay categorías para asignar.</p>}
          </>
        )}
        <div className="flavor-appearance-inputs">
          <label>
            Icono
            <select value={emoji} onChange={(event) => setEmoji(event.target.value)}>
              <option value="">Por categoría</option>
              {previousIcon && !flavorIcons.some(([icon]) => icon === previousIcon) && <option value={previousIcon}>{previousIcon} Icono actual</option>}
              {flavorIcons.map(([icon, label]) => <option key={icon} value={icon}>{icon} {label}</option>)}
            </select>
          </label>
          <label>
            Color de fondo
            <input type="color" value={safeFlavorColor(color)} onChange={(event) => setColor(event.target.value)} />
          </label>
        </div>
        {color && <button type="button" className="text-button reset-flavor-color" onClick={() => setColor("")}>Usar color por defecto</button>}
        <div className="flavor-preview">
          <FlavorMark emoji={emoji || product?.categoryEmoji || selectedCategory?.emoji} color={color} />
          <strong>{product?.name || trimmedName || "Vista previa del sabor"}</strong>
        </div>
      </fieldset>
    </FormDialog>
  );
}

function RegistrationDialog({ products, groups, session, onDismiss, onSaved }: {
  products: Product[];
  groups: WorkGroup[];
  session: WorkGroup;
  onDismiss: () => void;
  onSaved: (record: Production) => void;
}) {
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState(session.id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const search = query.trim().toLocaleLowerCase("es-PE");
  const matchedProducts = products.filter((product) => product.name.toLocaleLowerCase("es-PE").includes(search));
  const matchedCategories = groupProducts(matchedProducts);
  const responsible = groups.find((group) => group.id === groupId);
  const points = responsible?.members.length ? 1 / responsible.members.length : null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (productId === null || points === null || saving) return;

    setSaving(true);
    setError(false);
    try {
      const production = await createProduction({ productId, workGroupId: groupId });
      onSaved(production);
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <FormDialog title="Registrar preparación" titleId="register-title" saving={saving} onDismiss={onDismiss} onSubmit={save}
      footer={
        <>
          {error && <p className="error-text" role="alert">No pudimos confirmar el registro. Revisa el historial antes de volver a guardarlo.</p>}
          {points !== null && <p className="muted">{responsible?.name} suma {numberLabel.format(points)} {points === 1 ? "punto" : "puntos"}.</p>}
          <button type="submit" className="button primary" disabled={productId === null || points === null || saving}>
            <Icon name="check" /> {saving ? "Guardando…" : "Guardar preparación"}
          </button>
        </>
      }>
      <fieldset disabled={saving}>
        <legend>¿Qué prepararon?</legend>
        <label className="search-field">
          <Icon name="search" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar sabor" aria-label="Buscar sabor" />
        </label>
        {matchedCategories.size > 0 ? (
          <div className="registration-categories">
            {[...matchedCategories].map(([category, options]) => (
              <section className="registration-category" key={category}>
                <h3>{category}</h3>
                <div className="product-options">
                  {options.map((product) => (
                    <label className="choice product-choice" key={product.id}>
                      <input type="radio" name="product" checked={productId === product.id} onChange={() => setProductId(product.id)} />
                      <FlavorMark emoji={product.emoji || product.categoryEmoji} color={product.color} />
                      <span>{product.name}</span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : <p className="empty-state">{products.length ? "No hay sabores que coincidan." : "No hay sabores activos."}</p>}
      </fieldset>
      <fieldset disabled={saving}>
        <legend>¿Quién estuvo a cargo?</legend>
        <div className="group-options">
          {groups.map((group) => (
            <label className="choice group-choice" key={group.id}>
              <input type="radio" name="group" checked={groupId === group.id} onChange={() => setGroupId(group.id)} />
              <GroupBadge group={group} />
              <span>{group.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </FormDialog>
  );
}

export default function App() {
  const [session, setSession] = useState<WorkGroup | null>(null);
  const [groups, setGroups] = useState<WorkGroup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [page, setPage] = useState<Page>("Inicio");
  const [month, setMonth] = useState("");
  const [historyFlavor, setHistoryFlavor] = useState<HistoryFlavor | null>(null);
  const [records, setRecords] = useState<Production[] | null>(null);
  const [recordsStatus, setRecordsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [recordsAttempt, setRecordsAttempt] = useState(0);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const orderedRecords = useMemo(() => orderProductions(records ?? []), [records]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getWorkGroups(controller.signal), getProducts(true, controller.signal)])
      .then(([loadedGroups, loadedProducts]) => {
        if (controller.signal.aborted) return;
        setGroups(loadedGroups);
        setProducts(loadedProducts);
        setCatalogStatus("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setCatalogStatus("error"); });
    return () => controller.abort();
  }, [catalogAttempt]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    getProductions(controller.signal)
      .then((loadedRecords) => {
        if (controller.signal.aborted) return;
        setRecords(loadedRecords);
        setRecordsStatus("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setRecordsStatus("error"); });
    return () => controller.abort();
  }, [session, recordsAttempt]);

  function refreshRecords() {
    setRecordsStatus("loading");
    setRecordsAttempt((attempt) => attempt + 1);
  }

  function enter(group: WorkGroup) {
    setPage("Inicio");
    setMonth("");
    setHistoryFlavor(null);
    setConfirmation("");
    setRecords(null);
    setRecordsStatus("loading");
    setSession(group);
  }

  function navigate(next: Page, flavor: HistoryFlavor | null = null) {
    setPage(next);
    setHistoryFlavor(flavor);
    window.scrollTo(0, 0);
  }

  function saved(record: Production) {
    setDialog(null);
    setConfirmation(record.productName + " · " + record.workGroupName + ". Preparación guardada.");
    setRecords((previous) => previous && [record, ...previous.filter((item) => item.id !== record.id)]);
    refreshRecords();
  }

  function savedFlavor(product: Product) {
    const changedAppearance = dialog?.kind === "flavor" && Boolean(dialog.product);
    setProducts((previous) => changedAppearance
      ? previous.map((item) => item.id === product.id ? product : item)
      : [...previous.filter((item) => item.id !== product.id), product]);
    if (changedAppearance) {
      setRecords((previous) => previous?.map((record) => record.productId === product.id
        ? { ...record, productEmoji: product.emoji, productColor: product.color }
        : record) ?? null);
    }
    setDialog(null);
    setConfirmation(product.name + (changedAppearance ? " · Apariencia actualizada." : " ya está disponible para registrar preparaciones."));
  }

  function openDialog(next: OpenDialog) {
    setConfirmation("");
    setDialog(next);
  }

  if (!session) {
    return (
      <main className="entry">
        <div className="entry-panel">
          <Brand />
          <h1>¿Quién prepara hoy?</h1>
          <p className="muted">Elige tu equipo de trabajo para empezar.</p>
          {catalogStatus === "loading" && <p className="entry-status" role="status">Conectando con el servidor…</p>}
          {catalogStatus === "error" && (
            <div className="entry-status" role="alert">
              <p>No pudimos cargar los equipos y sabores.</p>
              <button type="button" className="button secondary" onClick={() => { setCatalogStatus("loading"); setCatalogAttempt((attempt) => attempt + 1); }}>Reintentar</button>
            </div>
          )}
          {catalogStatus === "ready" && (
            groups.length > 0 ? <div className="entry-options">
              {groups.map((group) => (
                <button key={group.id} type="button" onClick={() => enter(group)}>
                  <GroupBadge group={group} />
                  <span><strong>{group.name}</strong><small>{group.isTeam ? "En equipo" : "Individual"}</small></span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div> : <p className="entry-status">Todavía no hay equipos registrados.</p>
          )}
        </div>
      </main>
    );
  }

  const dates = orderedRecords.flatMap(({ date }) => date ? [monthKey.format(date)] : []);
  const months = [...new Set(month ? [...dates, month] : dates)].sort().reverse();
  const filtered = month
    ? orderedRecords.filter(({ date }) => date !== null && monthKey.format(date) === month)
    : orderedRecords;
  const historyRecords = historyFlavor
    ? filtered.filter(({ record }) => record.productId === historyFlavor.id)
    : filtered;
  const groupsById = new Map(groups.map((group) => [group.id, { group, count: 0, points: 0 }]));
  for (const { record } of filtered) {
    const result = groupsById.get(record.workGroupId);
    if (result) {
      result.count += 1;
      result.points += record.points;
    }
  }
  const scores = [...groupsById.values()].sort((first, second) => second.points - first.points);
  const highest = scores[0]?.points ?? 0;
  const categories = page === "Sabores" ? groupProducts(products) : null;
  const empty = month ? "Todavía no hay preparaciones en este mes." : "Todavía no hay preparaciones registradas.";

  return (
    <div className="app-shell">
      <header className="workspace-header">
        <div className="header-inner">
          <Brand />
          <button type="button" className="team-switch" onClick={() => setSession(null)} aria-label={"Cambiar equipo. Equipo actual: " + session.name}>
            <GroupBadge group={session} /><span>{session.name}</span><Icon name="switch" />
          </button>
        </div>
      </header>

      <div className="workspace">
        <nav className="navigation" aria-label="Navegación principal">
          {pages.map((item) => (
            <button type="button" key={item.name} aria-current={page === item.name ? "page" : undefined} onClick={() => navigate(item.name)}>
              <Icon name={item.icon} /><span>{item.name}</span>
            </button>
          ))}
        </nav>

        <main className="content">
          {page === "Inicio" && (
            <section className="hero" aria-labelledby="home-title">
              <div className="hero-content">
                <p className="hero-date">{dayLabel.format(new Date())}</p>
                <h1 id="home-title">Producción</h1>
                <button type="button" className="button hero-action" onClick={() => openDialog({ kind: "register" })}><Icon name="plus" /> Registrar preparación</button>
              </div>
              <div className="hero-art" aria-hidden="true"><Icon name="flavors" /></div>
            </section>
          )}
          {page !== "Inicio" && (
            <div className="page-heading">
              <h1 className="page-title">{page}</h1>
              {page === "Sabores" && (
                <button type="button" className="button primary" onClick={() => openDialog({ kind: "flavor" })}><Icon name="plus" /> Nuevo sabor</button>
              )}
            </div>
          )}
          {confirmation && <p className="confirmation" role="status"><Icon name="check" />{confirmation}</p>}

          {page !== "Sabores" && (
            <>
              <div className="period-bar">
                <label className="period-control">
                  <Icon name="calendar" />
                  <span className="sr-only">Período</span>
                  <select value={month} onChange={(event) => setMonth(event.target.value)}>
                    <option value="">Todo el historial</option>
                    {months.map((key) => (
                      <option key={key} value={key}>{monthLabel.format(new Date(key + "-15T12:00:00Z"))}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="button secondary update-button" onClick={refreshRecords} disabled={recordsStatus === "loading"}>
                  <Icon name="refresh" /> Actualizar
                </button>
              </div>
              {recordsStatus === "loading" && records === null && <p className="empty-state" role="status">Cargando preparaciones…</p>}
              {recordsStatus === "error" && <p className="notice" role="alert">No pudimos actualizar las preparaciones. Usa «Actualizar» para reintentar.</p>}
              {records !== null && page === "Inicio" && (
                <div className="dashboard-grid">
                  <section className="panel overview">
                    <div className="panel-heading"><h2>Preparaciones</h2><strong className="period-total">{filtered.length}</strong></div>
                    <h3>Puntos por equipo</h3>
                    <ul className="score-list">
                      {scores.map(({ group, count, points }) => {
                        const missing = Math.ceil((highest - points) * group.members.length - 1e-9);
                        return (
                          <li key={group.id}>
                            <GroupBadge group={group} />
                            <div>
                              <strong>{group.name}</strong>
                              <span>{count} {count === 1 ? "preparación" : "preparaciones"}</span>
                              {missing > 0 && <span className="samples-needed">Para alcanzar al primero: {missing} {missing === 1 ? "preparación" : "preparaciones"}</span>}
                            </div>
                            <strong className="score-points">{numberLabel.format(points)} pts</strong>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                  <section className="panel recent-panel">
                    <div className="panel-heading">
                      <h2>Últimas preparaciones</h2>
                      <button type="button" className="text-button" onClick={() => navigate("Historial")}>Ver historial <Icon name="arrow" /></button>
                    </div>
                    <HistoryList records={filtered.slice(0, 5)} empty={empty} />
                  </section>
                </div>
              )}
              {records !== null && page === "Historial" && (
                <section className="panel recent-panel">
                  <div className="panel-heading"><h2>{historyRecords.length} {historyRecords.length === 1 ? "preparación" : "preparaciones"}</h2></div>
                  {historyFlavor && (
                    <div className="history-flavor-filter">
                      <span>{historyFlavor.name}</span>
                      <button type="button" className="text-button" onClick={() => setHistoryFlavor(null)}><Icon name="close" /> Quitar filtro</button>
                    </div>
                  )}
                  <HistoryList records={historyRecords} empty={historyFlavor ? "No hay preparaciones de este sabor en el período." : empty} />
                </section>
              )}
              {records !== null && page === "Estadísticas" && (
                <FlavorStatistics records={filtered} empty={empty} onViewHistory={(flavor) => navigate("Historial", flavor)} />
              )}
            </>
          )}

          {categories && (
            <div className="catalog">
              {categories.size === 0 && <p className="empty-state">Todavía no hay sabores activos.</p>}
              {[...categories].map(([category, categoryProducts]) => (
                <section className="panel catalog-section" key={category}>
                  <h2>{category}</h2>
                  <ul className="catalog-grid">
                    {categoryProducts.map((product) => (
                      <li key={product.id}>
                        <FlavorMark emoji={product.emoji || product.categoryEmoji} color={product.color} />
                        <strong>{product.name}</strong>
                        <button type="button" className="icon-button catalog-edit" title="Editar apariencia"
                          aria-label={"Editar apariencia de " + product.name} onClick={() => openDialog({ kind: "flavor", product })}>
                          <Icon name="edit" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
      {dialog?.kind === "register" && <RegistrationDialog products={products} groups={groups} session={session} onDismiss={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === "flavor" && <FlavorDialog product={dialog.product} onDismiss={() => setDialog(null)} onSaved={savedFlavor} />}
    </div>
  );
}
