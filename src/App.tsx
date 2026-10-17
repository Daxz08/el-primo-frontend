import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  getWorkGroups,
  getProducts,
  getProductions,
  createProduction,
  getRanking,
  getFavorites,
  getSummary,
} from "./services/api";
import type {
  WorkGroup,
  Product,
  Production,
  Ranking,
  FavoriteProduct,
  Summary,
  PeriodType,
} from "./types/api";

type IconName = "home" | "plus" | "history" | "catalog" | "chart" | "user" | "settings" | "search" | "bell" | "arrow";

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
  catalog: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5v15A2.5 2.5 0 0 0 6.5 23H20v-5"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  arrow: <><path d="m9 18 6-6-6-6"/></>,
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const nav = [
  ["Dashboard", "home"],
  ["Registrar", "plus"],
  ["Historial", "history"],
  ["Catálogo", "catalog"],
  ["Estadísticas", "chart"],
  ["Mi perfil", "user"],
] as const;

function periodToKey(label: string): PeriodType {
  switch (label) {
    case "Esta semana": return "WEEK";
    case "Este mes": return "MONTH";
    case "Últimos 3 meses": return "QUARTER";
    case "Todo": return "ALL";
    default: return "WEEK";
  }
}

function initialsOf(name: string): string {
  if (!name) return "??";
  const clean = name.trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2 && name !== "Ghorman & Tony") return (parts[0][0] + parts[1][0]).toUpperCase();
  if (name === "Ghorman & Tony") return "G&T";
  return clean.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (diffDays <= 0) return `Hoy, ${hh}:${mm}`;
  if (diffDays === 1) return `Ayer, ${hh}:${mm}`;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${d.toLocaleDateString("es-PE", opts)}, ${hh}:${mm}`;
}

export default function App() {
  const [session, setSession] = useState<WorkGroup | null>(null);
  const [workGroups, setWorkGroups] = useState<WorkGroup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [ranking, setRanking] = useState<Ranking[]>([]);
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [period, setPeriod] = useState("Esta semana");
  const [active, setActive] = useState("Dashboard");
  const [showForm, setShowForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [responsibleId, setResponsibleId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [g, p] = await Promise.all([getWorkGroups(), getProducts(true)]);
        if (!mounted) return;
        setWorkGroups(g);
        setProducts(p);
        if (g.length > 0) setResponsibleId(g[0].id);
      } catch (e) {
        console.error(e);
        if (mounted) setError("No se pudo conectar con el servidor.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    (async () => {
      const key = periodToKey(period);
      try {
        const [rank, favs, sum, prods] = await Promise.all([
          getRanking(key), getFavorites(key, 5), getSummary(key), getProductions(),
        ]);
        if (!mounted) return;
        setRanking(rank);
        setFavorites(favs);
        setSummary(sum);
        setProductions(prods);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { mounted = false; };
  }, [session, period]);

  async function handleCreateProduction() {
    if (!selectedProductId || !responsibleId) {
      setError("Selecciona producto y responsable.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await createProduction({ productId: selectedProductId, workGroupId: responsibleId });
      setShowForm(false);
      setSelectedProductId(null);

      const key = periodToKey(period);
      const [rank, favs, sum, prods] = await Promise.all([
        getRanking(key), getFavorites(key, 5), getSummary(key), getProductions(),
      ]);
      setRanking(rank);
      setFavorites(favs);
      setSummary(sum);
      setProductions(prods);
    } catch (e) {
      console.error(e);
      setError("No se pudo registrar la producción.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-brand brand"><div className="brand-mark"><span>🍧</span><i>✦</i></div><div><strong>Dulcería</strong><span>el Primo</span></div></div>
        <p style={{ color: "#858690" }}>Cargando…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="login-page">
        <div className="login-brand brand"><div className="brand-mark"><span>🍧</span><i>✦</i></div><div><strong>Dulcería</strong><span>el Primo</span></div></div>
        <div className="login-copy"><p className="eyebrow">PANEL DE PRODUCCIÓN</p><h1>¿Quién está preparando hoy?</h1><p>Elige tu equipo para entrar. Aquí todo suma, primo.</p></div>
        <div className="login-options">
          {workGroups.map((g) => (
            <button key={g.id} onClick={() => setSession(g)}>
              {g.isTeam ? (
                <div className="double-avatar large">
                  {g.members.map((m) => <div key={m.id} className="avatar" style={{ background: m.color }}>{initialsOf(m.name)}</div>)}
                </div>
              ) : (
                <div className="avatar large-avatar" style={{ background: g.members[0]?.color ?? "#9b82ef" }}>{initialsOf(g.members[0]?.name ?? "?")}</div>
              )}
              <strong>{g.name}</strong>
              <span>{g.isTeam ? "Equipo fijo · 0.5 puntos por preparación" : "Trabajo individual · 1 punto por preparación"}</span>
              <b>Entrar como {g.isTeam ? "equipo" : g.name} <Icon name="arrow" /></b>
            </button>
          ))}
        </div>
        <p className="login-note">Sin contraseñas, porque estamos en familia.</p>
        {error && <p style={{ color: "coral", fontSize: 12 }}>{error}</p>}
      </div>
    );
  }

  const leader = summary?.leader ?? ranking[0] ?? null;
  const favorite = summary?.favoriteProduct ?? favorites[0] ?? null;
  const totalProductions = summary?.totalProductions ?? productions.length;
  const recentProductions = productions.slice(0, 3);
  const historyProductions = productions;

  // El ranking ahora mapea los GRUPOS
  const rankingView: Ranking[] = workGroups.map((g) => {
    const r = ranking.find((x) => x.id === g.id);
    return r ?? { id: g.id, name: g.name, isTeam: g.isTeam, members: g.members, totalPoints: 0, totalProductions: 0, position: 0 };
  });
  rankingView.sort((a, b) => b.totalPoints - a.totalPoints);
  rankingView.forEach((r, i) => (r.position = i + 1));
  const maxPoints = Math.max(1, ...rankingView.map((r) => r.totalPoints));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><span>🍧</span><i>✦</i></div><div><strong>Dulcería</strong><span>el Primo</span></div></div>
        <nav className="side-nav" aria-label="Navegación principal">
          <p>MENÚ</p>
          {nav.map(([label, icon]) => (
            <button key={label} className={active === label ? "active" : ""} onClick={() => setActive(label)}>
              <Icon name={icon} /><span>{label}</span>{label === "Registrar" && <b>+</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button><Icon name="settings" /><span>Configuración</span></button>
          <div className="mini-profile">
            {session.isTeam ? (
              <div className="double-avatar">{session.members.map((m) => <div key={m.id} className="avatar" style={{ background: m.color }}>{initialsOf(m.name)}</div>)}</div>
            ) : (
              <div className="avatar" style={{ background: session.members[0]?.color }}>{initialsOf(session.members[0]?.name ?? "?")}</div>
            )}
            <div><strong>{session.name}</strong><span>{session.isTeam ? "Equipo productor" : "Productor individual"}</span></div>
            <Icon name="arrow" />
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div className="mobile-brand brand"><div className="brand-mark"><span>🍧</span></div><strong>El Primo</strong></div>
          <label className="search"><Icon name="search" /><input aria-label="Buscar" placeholder="Buscar producción, sabor..." /></label>
          <div className="top-actions">
            <button aria-label="Notificaciones" className="icon-button"><Icon name="bell" /><i /></button>
            {session.isTeam ? (
              <div className="double-avatar">{session.members.map((m) => <div key={m.id} className="avatar" style={{ background: m.color }}>{initialsOf(m.name)}</div>)}</div>
            ) : (
              <div className="avatar" style={{ background: session.members[0]?.color }}>{initialsOf(session.members[0]?.name ?? "?")}</div>
            )}
          </div>
        </header>

        <div className="content">
          <section className="welcome">
            <div>
              <p className="eyebrow">{new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</p>
              <h1>¡Buen día, {session.isTeam ? "primos" : session.name}! <span>👋</span></h1>
              <p>Todo va sobre ruedas. Mira cómo va la producción {period.toLowerCase()}.</p>
            </div>
            <div className="quick-actions">
              <button className="secondary" onClick={() => setActive("Catálogo")}><span>🍓</span> Nuevo sabor</button>
              <button className="primary" onClick={() => setShowForm(true)}><Icon name="plus" /> Registrar producción</button>
            </div>
          </section>

          {active === "Mi perfil" ? (
            <section className="profiles-page">
              <div className="section-heading"><p className="eyebrow">EL EQUIPO</p><h2>Perfiles del equipo</h2><p>Los puntos se acumulan por equipo de trabajo.</p></div>
              <div className="profile-grid">
                {workGroups.map((g) => {
                  const r = rankingView.find((x) => x.id === g.id);
                  return (
                    <article className="card profile-card" key={g.id}>
                      {g.isTeam ? (
                        <div className="double-avatar large" style={{ margin: "0 auto", justifyContent: "center", marginBottom: 12 }}>
                          {g.members.map((m) => <div key={m.id} className="avatar profile-avatar" style={{ background: m.color, width: 68, height: 68, fontSize: 16 }}>{initialsOf(m.name)}</div>)}
                        </div>
                      ) : (
                        <div className="avatar profile-avatar" style={{ background: g.members[0]?.color }}>{initialsOf(g.members[0]?.name ?? "?")}</div>
                      )}
                      <h3>{g.name}</h3>
                      <strong>{(r?.totalPoints ?? 0).toFixed(2)} puntos</strong>
                      <span className={`work-chip ${g.isTeam ? "" : "solo"}`}>{g.isTeam ? "Trabaja en equipo" : "Trabaja individualmente"}</span>
                      <div className="profile-stat"><span>Este período</span><b>{r?.totalPoints.toFixed(2) ?? "0.00"} pts</b></div>
                    </article>
                  );
                })}
              </div>
            </section>
                    ) : active === "Estadísticas" ? (
            <section className="stats-page card">
              <p className="eyebrow">ANALYTICS</p><h2>Distribución por equipo</h2><p>Puntos acumulados por preparaciones</p>
              
              {(() => {
                const totalPoints = rankingView.reduce((s, r) => s + r.totalPoints, 0);
                return (
                  <div className="stats-content">
                    <div 
                      className="team-donut" 
                      style={totalPoints > 0 ? { background: buildTeamDonut(rankingView, totalPoints) } : undefined}
                    >
                      <div>
                        <strong>{totalPoints.toFixed(0)}</strong>
                        <span>puntos</span>
                      </div>
                    </div>
                    <div className="stats-legend">
                      {rankingView.map((r) => (
                        <p key={r.id}>
                          <i style={{ background: r.members[0]?.color }} />
                          <span>{r.name}</span>
                          <strong>{r.totalPoints.toFixed(2)} pts</strong>
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="insight large">
                <span>💡</span>
                <p><strong>Ritmo de equilibrio 2 a 1</strong>Un equipo de 2 necesita el doble de preparaciones para igualar los puntos de un productor individual.</p>
              </div>
            </section>
          ) : active === "Historial" ? (
            <section className="card activity-card history-page">
              <div className="card-head"><div><p className="eyebrow">REGISTROS</p><h2>Historial de producciones</h2><p>Una preparación por cada registro</p></div></div>
              <div className="activity-list">
                {historyProductions.length === 0 ? (
                  <p style={{ color: "#858690", padding: 20 }}>Aún no hay producciones registradas.</p>
                ) : (
                  historyProductions.map((item) => (
                    <div className="activity-row" key={item.id}>
                      <div className="product-icon" style={{ background: `${item.productColor ?? "#eee"}30` }}>{item.productEmoji ?? "🍧"}</div>
                      {item.isTeam ? (
                        <div className="double-avatar activity-avatar">{item.members.map((m) => <div key={m.id} className="avatar" style={{ background: m.color }}>{initialsOf(m.name)}</div>)}</div>
                      ) : (
                        <div className="avatar violet activity-avatar" style={{ background: item.members[0]?.color }}>{initialsOf(item.members[0]?.name ?? "?")}</div>
                      )}
                      <div className="activity-title"><strong>{item.productName}</strong><span>{item.workGroupName} · {timeAgo(item.producedAt)}</span></div>
                      <b className="point-badge">{item.isTeam ? `Grupo · ${item.points.toFixed(2)} pts` : `Individual · ${item.points.toFixed(0)} pt`}</b>
                      <button className="more">•••</button>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : active !== "Dashboard" ? (
            <section className="empty-page card">
              <div className="empty-icon">{active === "Catálogo" ? "🍓" : active === "Registrar" ? "🍧" : "📊"}</div>
              <p className="eyebrow">DULCERÍA EL PRIMO</p><h2>{active}</h2><p>Esta sección está lista para continuar la experiencia de producción.</p>
              <button className="primary" onClick={() => active === "Registrar" ? setShowForm(true) : setActive("Dashboard")}>{active === "Registrar" ? "Registrar ahora" : "Volver al dashboard"}</button>
            </section>
          ) : (
            <>
              <div className="period-row">
                <div className="period-tabs">
                  {["Esta semana", "Este mes", "Últimos 3 meses", "Todo"].map((item) => (
                    <button className={period === item ? "active" : ""} onClick={() => setPeriod(item)} key={item}>{item}</button>
                  ))}
                </div>
              </div>

              <section className="metrics">
                <article className="metric-card coral-wash">
                  <div className="metric-icon">🍧</div>
                  <div><span>PREPARACIONES</span><strong>{totalProductions}</strong><small><b>Período:</b> {period.toLowerCase()}</small></div>
                  <div className="spark"><i /><i /><i /><i /><i /><i /><i /></div>
                </article>
                <article className="metric-card mint-wash">
                  <div className="metric-icon">🏅</div>
                  <div><span>LÍDER DEL PERÍODO</span><strong>{leader?.name ?? "—"}</strong><small><b>{(leader?.totalPoints ?? 0).toFixed(2)} puntos</b> en total</small></div>
                  {leader && <div className="leader-avatar" style={{ background: leader.isTeam ? leader.members[0]?.color : leader.members[0]?.color }}>{initialsOf(leader.name)}<span>1</span></div>}
                </article>
                <article className="metric-card yellow-wash">
                  <div className="metric-icon">{favorite?.emoji ?? "🥭"}</div>
                  <div><span>FAVORITO</span><strong>{favorite?.productName.replace("Cremolada de ", "") ?? "—"}</strong><small><b>{favorite?.totalProductions ?? 0} preparaciones</b> {period.toLowerCase()}</small></div>
                </article>
              </section>

              <section className="dashboard-grid">
                <article className="card ranking-card">
                  <div className="card-head">
                    <div><h2>Ranking de equipos</h2><p>{leader ? `¡${leader.name} va liderando ${period.toLowerCase()}! 🔥` : "Sin producciones todavía"}</p></div>
                    <button className="link" onClick={() => setActive("Estadísticas")}>Ver estadísticas <Icon name="arrow" /></button>
                  </div>
                  <div className="ranking-list">
                    {rankingView.map((person) => (
                      <div className="rank-row" key={person.id}>
                        <span className={`medal medal-${person.position}`}>{person.position}</span>
                        {person.isTeam ? (
                          <div className="double-avatar" style={{ minWidth: 42 }}>
                            {person.members.map((m) => <div key={m.id} className="avatar" style={{ width: 30, height: 30, fontSize: 9, background: m.color }}>{initialsOf(m.name)}</div>)}
                          </div>
                        ) : (
                          <div className="avatar" style={{ width: 33, height: 33, fontSize: 9, background: person.members[0]?.color }}>{initialsOf(person.members[0]?.name ?? "?")}</div>
                        )}
                        <div className="rank-main">
                          <div><strong>{person.name}</strong><span>{person.totalPoints.toFixed(2)} pts</span></div>
                          <div className="progress"><i style={{ width: `${(person.totalPoints / maxPoints) * 100}%`, background: person.members[0]?.color }} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="insight">
                    <span>💡</span>
                    <p><strong>Ritmo de equilibrio 2 a 1</strong>Un equipo de 2 necesita el doble de preparaciones para igualar los puntos de un productor individual.</p>
                  </div>
                </article>

                <article className="card chart-card">
                  <div className="card-head"><div><h2>Producción por equipo</h2><p>Puntos obtenidos · {period.toLowerCase()}</p></div><button className="more">•••</button></div>
                  <div className="bar-chart">
                    {rankingView.map((r) => {
                      const h = maxPoints > 0 ? (r.totalPoints / maxPoints) * 100 : 0;
                      return (
                        <div className="bar-col" key={r.id}>
                          <div className="bar-track"><i style={{ height: `${Math.max(h, 4)}%`, background: r.members[0]?.color }} /></div>
                          <span style={{ fontSize: 9 }}>{r.name.substring(0, 4)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="legend">
                    {rankingView.map((r) => (
                      <span key={r.id}><i style={{ background: r.members[0]?.color }} />{r.name}</span>
                    ))}
                  </div>
                </article>

                <article className="card favorites-card">
                  <div className="card-head"><div><h2>Sabores favoritos</h2><p>Los más preparados</p></div><button className="link" onClick={() => setActive("Catálogo")}>Ver catálogo <Icon name="arrow" /></button></div>
                  <div className="donut-wrap">
                    <div className="donut" style={favorites.length > 0 ? { background: buildDonut(favorites, totalProductions) } : undefined}>
                      <div><strong>{totalProductions}</strong><span>preparaciones</span></div>
                    </div>
                    <div className="flavor-list">
                      {favorites.length === 0 ? (
                        <p style={{ color: "#858690" }}>Sin datos aún</p>
                      ) : (
                        favorites.map((f) => {
                          const pct = totalProductions > 0 ? Math.round((f.totalProductions / totalProductions) * 100) : 0;
                          return (
                            <p key={f.productId}><i style={{ background: f.color ?? "#ccc" }} />{f.productName.replace("Cremolada de ", "")}{" "}<strong>{f.totalProductions} <small>{pct}%</small></strong></p>
                          );
                        })
                      )}
                    </div>
                  </div>
                </article>
              </section>

              <section className="card activity-card">
                <div className="card-head"><div><h2>Últimas producciones</h2><p>Lo que el equipo ha preparado recientemente</p></div><button className="link" onClick={() => setActive("Historial")}>Ver historial <Icon name="arrow" /></button></div>
                <div className="activity-list">
                  {recentProductions.length === 0 ? (
                    <p style={{ color: "#858690", padding: 20 }}>Aún no hay producciones registradas.</p>
                  ) : (
                    recentProductions.map((item) => (
                      <div className="activity-row" key={item.id}>
                        <div className="product-icon" style={{ background: `${item.productColor ?? "#eee"}30` }}>{item.productEmoji ?? "🍧"}</div>
                        {item.isTeam ? (
                          <div className="double-avatar activity-avatar">{item.members.map((m) => <div key={m.id} className="avatar" style={{ background: m.color }}>{initialsOf(m.name)}</div>)}</div>
                        ) : (
                          <div className="avatar activity-avatar" style={{ background: item.members[0]?.color }}>{initialsOf(item.members[0]?.name ?? "?")}</div>
                        )}
                        <div className="activity-title"><strong>{item.productName}</strong><span>{item.workGroupName} · {timeAgo(item.producedAt)}</span></div>
                        <b className="point-badge">{item.isTeam ? `Grupo · ${item.points.toFixed(2)} pts` : `Individual · ${item.points.toFixed(0)} pt`}</b>
                        <button className="more">•••</button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <nav className="bottom-nav">
        {nav.slice(0, 5).map(([label, icon]) => (
          <button key={label} className={active === label ? "active" : ""} onClick={() => label === "Registrar" ? setShowForm(true) : setActive(label)}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setShowForm(false)}>×</button>
            <p className="eyebrow">NUEVA PRODUCCIÓN</p><h2>¿Qué prepararon hoy?</h2><p>Selecciona el producto y quién estuvo a cargo.</p>
            <div className="product-options">
              {products.map((p) => (
                <button key={p.id} className={selectedProductId === p.id ? "selected" : ""} onClick={() => setSelectedProductId(p.id)} style={selectedProductId === p.id ? { borderColor: p.color ?? "#ff6b6b" } : undefined}>
                  {p.emoji ?? "🍧"}<span>{p.name.replace("Cremolada de ", "")}</span>
                </button>
              ))}
            </div>
            <h3 className="field-label">¿QUIÉN ESTUVO A CARGO?</h3>
            <div className="responsible-options">
              {workGroups.map((g) => (
                <button key={g.id} className={responsibleId === g.id ? "selected" : ""} onClick={() => setResponsibleId(g.id)}>
                  {g.isTeam ? (
                    <div className="double-avatar">{g.members.map((m) => <div key={m.id} className="avatar" style={{ background: m.color }}>{initialsOf(m.name)}</div>)}</div>
                  ) : (
                    <div className="avatar" style={{ background: g.members[0]?.color }}>{initialsOf(g.members[0]?.name ?? "?")}</div>
                  )}
                  <span><strong>{g.name}</strong><small>{g.isTeam ? "Equipo fijo" : "Individual"}</small></span>
                  <i />
                </button>
              ))}
            </div>
            {(() => {
              const g = workGroups.find((x) => x.id === responsibleId) ?? null;
              if (!g) return null;
              const pts = g.isTeam ? 0.5 : 1.0;
              return (
                <div className="points-preview">
                  <span>⚡</span>
                  <p><strong>Esta producción otorgará {pts} puntos al equipo</strong>{g.isTeam ? `${g.name} sumará 0.5 pts` : `${g.name} sumará 1.0 pt`}</p>
                </div>
              );
            })()}
            {error && <p style={{ color: "coral", fontSize: 12, marginTop: 8 }}>{error}</p>}
            <button className="primary full" onClick={handleCreateProduction} disabled={saving || !selectedProductId || !responsibleId} style={saving ? { opacity: 0.6, cursor: "not-allowed" } : undefined}>
              {saving ? "Registrando…" : "Continuar registro"}<Icon name="arrow" />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function buildDonut(favorites: FavoriteProduct[], total: number): string {
  if (total === 0 || favorites.length === 0) return "conic-gradient(#eee 0 100%)";
  const palette = ["#ffb54d", "#ff7e87", "#ffd65a", "#555663", "#e9dfd3"];
  let acc = 0;
  const stops = favorites.slice(0, 5).map((f, i) => {
    const start = acc;
    const pct = (f.totalProductions / total) * 100;
    acc += pct;
    const color = f.color && /^#[0-9a-f]{6}$/i.test(f.color) ? f.color : palette[i % palette.length];
    return `${color} ${start}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function buildTeamDonut(ranking: Ranking[], total: number): string {
  if (total === 0 || ranking.length === 0) return "conic-gradient(#eee 0 100%)";
  
  let acc = 0;
  const stops = ranking.map((r) => {
    const start = acc;
    const pct = (r.totalPoints / total) * 100;
    acc += pct;
    // Usamos el color del primer integrante del equipo
    const color = r.members[0]?.color || "#ccc";
    return `${color} ${start}% ${acc}%`;
  });
  
  return `conic-gradient(${stops.join(", ")})`;
}