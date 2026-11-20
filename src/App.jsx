import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Box,
  DollarSign,
  Gamepad2,
  Headphones,
  Keyboard,
  Laptop,
  LogOut,
  Menu,
  Pencil,
  Plus,
  QrCode,
  Search,
  Smartphone,
  Trash2,
} from "lucide-react";
import { getStatus, CATEGORIES } from "./data.js";
import ProductPanel from "./ProductPanel.jsx";
import AuthScreen from "./AuthScreen.jsx";
import { getProductPhotoUrl, isSupabaseConfigured, supabase } from "./supabase.js";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import { formatMoney, translate } from "./i18n.js";

const QrTools = lazy(() => import("./QrTools.jsx"));

const CATEGORY_ICON = {
  Computers: Laptop,
  Phones: Smartphone,
  Audio: Headphones,
  Accessories: Keyboard,
  Gaming: Gamepad2,
};

function Thumb({ product }) {
  if (product.photo) return <img className="thumb" src={product.photo} alt={product.name} />;
  const Icon = CATEGORY_ICON[product.category] || Box;
  const dark = ["#1c1c1f", "#1f2a1f", "#a3237f"].includes(product.tone);
  return (
    <div className="thumb thumb--placeholder" style={{ background: product.tone, color: dark ? "#fff" : "#1b2437" }}>
      <Icon size={26} strokeWidth={1.6} />
    </div>
  );
}

function Sidebar({ open, user, profile, page, onNavigate, onSignOut, t }) {
  const name = profile?.display_name || user.email || t("nav.teamMember");
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
      <div className="brand">
        <img className="brand__logo" src="/electro-bejaad-logo.png" alt="ELECTRO BEJAAD logo" />
        <span className="brand__name">ELECTRO BEJAAD</span>
      </div>
      <nav className="nav">
        {[
          ["overview", BarChart3, "nav.overview"],
          ["stock", Box, "nav.stock"],
          ["categories", Search, "nav.categories"],
          ["activity", Activity, "nav.activity"],
          ["qr", QrCode, "nav.qr"],
        ].map(([pageKey, Icon, labelKey]) => (
          <button
            className={`nav__item ${page === pageKey ? "nav__item--active" : ""}`}
            onClick={() => onNavigate(pageKey)}
            aria-current={page === pageKey ? "page" : undefined}
            key={pageKey}
          >
            <Icon size={20} strokeWidth={1.8} />
            {t(labelKey)}
          </button>
        ))}
      </nav>
      <div className="user">
        <div className="user__avatar">{initials || "U"}</div>
        <div className="user__meta">
          <strong>{name}</strong>
          <span>{user.email}</span>
        </div>
        <button className="icon-btn user__signout" aria-label={t("nav.signOut")} title={t("nav.signOut")} onClick={onSignOut}>
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
}

function StatCard({ icon, tone, label, value, hint }) {
  return (
    <div className="stat">
      <div className={`stat__icon stat__icon--${tone}`}>{icon}</div>
      <div className="stat__body">
        <span className="stat__label">{label}</span>
        <span className="stat__value">{value}</span>
        <span className="stat__hint">{hint}</span>
      </div>
    </div>
  );
}

function AuthLoading({ language, onLanguageChange, t }) {
  return (
    <main className="auth-page">
      <div className="auth-language"><LanguageSwitcher language={language} onChange={onLanguageChange} /></div>
      <p className="muted">{t("loading.session")}</p>
    </main>
  );
}

export default function App() {
  const [language, setLanguage] = useState(() => {
    try {
      return window.localStorage.getItem("voltstock-language") === "fr" ? "fr" : "en";
    } catch {
      return "en";
    }
  });
  const t = useCallback((key, values) => translate(language, key, values), [language]);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [products, setProducts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [movements, setMovements] = useState([]);
  const [movementTotals, setMovementTotals] = useState({ items_in: 0, items_out: 0 });
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [movementFilter, setMovementFilter] = useState("all");
  const [page, setPage] = useState("overview");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `ELECTRO BEJAAD · ${t(`page.${page}`)}`;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.content = language === "fr"
        ? "Gestion partagée de l’inventaire de votre équipe."
        : "Shared inventory management for your team.";
    }
    try {
      window.localStorage.setItem("voltstock-language", language);
    } catch {
      // Language selection still works for this session if storage is unavailable.
    }
  }, [language, page, t]);

  useEffect(() => {
    const updateOnline = () => {
      const connected = navigator.onLine;
      setOnline(connected);
      if (connected && session?.user) setRefreshToken((value) => value + 1);
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setActionError(error.message);
      setSession(data?.session || null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProducts([]);
      setProfiles({});
      setMovements([]);
      setMovementTotals({ items_in: 0, items_out: 0 });
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("profiles").select("id,display_name,email"),
      supabase.from("inventory_stock_movements")
        .select("id,product_id,product_name,sku,direction,quantity,stock_before,stock_after,actor_id,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(100),
      supabase.from("inventory_movement_totals").select("items_in,items_out").single(),
    ]).then(([productResult, profileResult, movementResult, totalsResult]) => {
      if (!active) return;
      const failed = [productResult, profileResult, movementResult, totalsResult].find((result) => result.error);
      if (failed) throw failed.error;
      setProducts((productResult.data || []).map((product) => ({
        ...product,
        price: Number(product.price),
        photo: getProductPhotoUrl(product.photo_path),
      })));
      setProfiles(Object.fromEntries((profileResult.data || []).map((profile) => [profile.id, profile])));
      setMovements(movementResult.data || []);
      setMovementTotals({
        items_in: Number(totalsResult.data.items_in),
        items_out: Number(totalsResult.data.items_out),
      });
    }).catch((error) => {
      if (active) setLoadError(error.message || t("error.unableLoadInventory"));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [session?.user?.id, refreshToken]);

  useEffect(() => {
    if (!session?.user) return undefined;
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setRefreshToken((value) => value + 1), 120);
    };
    const channel = supabase
      .channel(`shared-inventory-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_activity" }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const stats = useMemo(() => {
    const units = products.reduce((sum, product) => sum + product.stock, 0);
    const attention = products.filter((product) => getStatus(product.stock) !== "in").length;
    const value = products.reduce((sum, product) => sum + product.stock * product.price, 0);
    const categories = new Set(products.map((product) => product.category)).size;
    return { units, attention, value, categories };
  }, [products]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !normalizedQuery
        || product.name.toLowerCase().includes(normalizedQuery)
        || product.sku.toLowerCase().includes(normalizedQuery);
      const matchesCategory = category === "All" || product.category === category;
      const matchesStatus = status === "All" || getStatus(product.stock) === status;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [products, query, category, status]);

  const visibleMovements = useMemo(
    () => movementFilter === "all" ? movements : movements.filter((movement) => movement.direction === movementFilter),
    [movements, movementFilter]
  );

  const openAdd = () => {
    setEditing(null);
    setActionError("");
    setPanelOpen(true);
  };
  const openEdit = (product) => {
    setEditing(product);
    setActionError("");
    setPanelOpen(true);
  };

  const handleSave = async (data) => {
    setActionError("");
    if (!navigator.onLine) throw new Error(t("error.offlineSave"));
    let photoPath = editing?.photo_path || null;
    if (data.photoFile) {
      const { data: upload, error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(crypto.randomUUID(), data.photoFile, { contentType: data.photoFile.type });
      if (uploadError) throw uploadError;
      photoPath = upload.path;
    }
    const productData = {
      name: data.name,
      sku: data.sku,
      category: data.category,
      price: data.price,
      stock: data.stock,
      photo_path: photoPath,
      tone: editing?.tone || "#e4e8ef",
    };
    const result = editing
      ? await supabase.from("products").update(productData).eq("id", editing.id)
      : await supabase.from("products").insert(productData);
    if (result.error) throw result.error;
    setPanelOpen(false);
    setRefreshToken((value) => value + 1);
  };

  const handleDelete = async (product) => {
    if (!window.confirm(t("error.deleteProduct", { name: product.name }))) return;
    setActionError("");
    if (!navigator.onLine) {
      setActionError(t("error.offlineSave"));
      return;
    }
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      setActionError(t("error.couldNotDelete", { name: product.name, message: error.message }));
      return;
    }
    setRefreshToken((value) => value + 1);
  };

  const handleSignOut = async () => {
    setActionError("");
    const { error } = await supabase.auth.signOut();
    if (error) setActionError(t("error.couldNotSignOut", { message: error.message }));
  };

  const navigate = useCallback((nextPage) => {
    setPage(nextPage);
    setMenuOpen(false);
  }, []);

  if (!isSupabaseConfigured || !authReady) {
    return isSupabaseConfigured ? (
      <AuthLoading language={language} onLanguageChange={setLanguage} t={t} />
    ) : (
      <AuthScreen
        configured={false}
        recoveryMode={false}
        onRecoveryComplete={() => {}}
        language={language}
        onLanguageChange={setLanguage}
        t={t}
      />
    );
  }
  if (!session || recoveryMode) {
    return (
      <AuthScreen
        configured
        recoveryMode={recoveryMode}
        onRecoveryComplete={() => setRecoveryMode(false)}
        language={language}
        onLanguageChange={setLanguage}
        t={t}
      />
    );
  }

  const currentProfile = profiles[session.user.id];

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label={t("nav.openMenu")} onClick={() => setMenuOpen((value) => !value)}>
          <Menu size={22} />
        </button>
        <img className="topbar__logo" src="/electro-bejaad-logo.png" alt="ELECTRO BEJAAD logo" />
        <span className="topbar__title">ELECTRO BEJAAD</span>
        <LanguageSwitcher language={language} onChange={setLanguage} />
      </header>

      <Sidebar
        open={menuOpen}
        user={session.user}
        profile={currentProfile}
        page={page}
        t={t}
        onNavigate={navigate}
        onSignOut={handleSignOut}
      />
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <main className="main">
        <div className="page-head">
          <div>
            <span className="eyebrow">{t("page.storeOperations")}</span>
            <h1>{t(`page.${page}`)}</h1>
            <p className="muted">{t(`page.${page}Description`)}</p>
          </div>
          <div className="page-actions">
            <div className="page-language"><LanguageSwitcher language={language} onChange={setLanguage} /></div>
            {(page === "stock" || page === "categories") && (
              <button className="btn btn--primary" onClick={openAdd} disabled={!online}>
                <Plus size={18} /> {t("page.addItem")}
              </button>
            )}
          </div>
        </div>

        {loadError && (
          <div className="app-notice app-notice--error" role="alert">
            <span>{loadError}</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setRefreshToken((value) => value + 1)}>
              {t("page.retry")}
            </button>
          </div>
        )}
        {actionError && <div className="app-notice app-notice--error" role="alert">{actionError}</div>}
        {!online && (
          <div className="app-notice app-notice--offline" role="status">
            {t("page.offline")}
          </div>
        )}
        {loading && <p className="load-note" role="status">{t("page.syncing")}</p>}

        {page === "overview" && (
          <>
            <section className="stats">
              <StatCard
                tone="blue"
                icon={<Box size={30} strokeWidth={1.8} />}
                label={t("stats.totalProducts")}
                value={products.length}
                hint={t("stats.acrossCategories", { count: stats.categories })}
              />
              <StatCard
                tone="purple"
                icon={<BarChart3 size={30} strokeWidth={2} />}
                label={t("stats.unitsInStock")}
                value={stats.units}
                hint={t("stats.availableToSell")}
              />
              <StatCard
                tone="amber"
                icon={<AlertTriangle size={30} strokeWidth={1.8} />}
                label={t("stats.needsAttention")}
                value={stats.attention}
                hint={t("stats.lowOrOut")}
              />
              <StatCard
                tone="green"
                icon={<DollarSign size={30} strokeWidth={2} />}
                label={t("stats.inventoryValue")}
                value={formatMoney(stats.value, language)}
                hint={t("stats.atRetailPrice")}
              />
            </section>
            <section className="page-links" aria-label={t("page.quickAccess")}>
              {[
                ["stock", Box, products.length, "page.stockLink"],
                ["categories", Search, stats.categories, "page.categoryLink"],
                ["activity", Activity, movements.length, "page.activityLink"],
              ].map(([target, Icon, count, labelKey]) => (
                <button className="page-link card" onClick={() => navigate(target)} key={target}>
                  <span className="page-link__icon"><Icon size={21} /></span>
                  <span className="page-link__copy">
                    <strong>{t(labelKey)}</strong>
                    <span>{t("page.recordsCount", { count })}</span>
                  </span>
                  <ArrowUpRight size={18} className="page-link__arrow" />
                </button>
              ))}
            </section>
          </>
        )}

        {page === "categories" && (
          <section className="category-grid" aria-label={t("nav.categories")}>
            <button
              className={`category-card card ${category === "All" ? "category-card--active" : ""}`}
              onClick={() => setCategory("All")}
              aria-pressed={category === "All"}
            >
              <span className="category-card__name">{t("table.allCategories")}</span>
              <span className="category-card__count">{products.length}</span>
              <span className="category-card__units">{t("table.itemsLabel")}</span>
            </button>
            {CATEGORIES.map((item) => {
              const items = products.filter((product) => product.category === item);
              const Icon = CATEGORY_ICON[item] || Box;
              return (
                <button
                  className={`category-card card ${category === item ? "category-card--active" : ""}`}
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                  key={item}
                >
                  <span className="category-card__icon"><Icon size={20} /></span>
                  <span className="category-card__name">{t(`category.${item}`)}</span>
                  <span className="category-card__count">{items.length}</span>
                  <span className="category-card__units">{t("table.itemsLabel")}</span>
                </button>
              );
            })}
          </section>
        )}

        {(page === "stock" || page === "categories") && <section className="card table-card">
          <div className="table-card__head">
            <h2>
              {page === "categories" && category !== "All" ? t(`category.${category}`) : t("table.allProducts")}{" "}
              <span className="muted small">
                {t("table.itemsCount", { visible: visible.length, total: products.length })}
              </span>
            </h2>
            <div className="filters">
              <label className="search">
                <Search size={18} />
                <input
                  type="search"
                  placeholder={t("table.search")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t("table.filterCategory")}>
                <option value="All">{t("table.allCategories")}</option>
                {CATEGORIES.map((item) => <option key={item} value={item}>{t(`category.${item}`)}</option>)}
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t("table.filterStatus")}>
                <option value="All">{t("table.allStatuses")}</option>
                <option value="in">{t("status.in")}</option>
                <option value="low">{t("status.low")}</option>
                <option value="out">{t("status.out")}</option>
              </select>
            </div>
          </div>

          <div className="table" role="table">
            <div className="row row--head" role="row">
              <span>{t("table.product")}</span>
              <span>{t("table.category")}</span>
              <span>{t("table.price")}</span>
              <span>{t("table.stock")}</span>
              <span>{t("table.status")}</span>
              <span />
            </div>

            {!loading && visible.length === 0 && (
              <div className="empty">{loadError ? t("table.inventoryLoadFailed") : t("table.noMatches")}</div>
            )}

            {visible.map((product) => {
              const productStatus = getStatus(product.stock);
              const changedBy = product.updated_by ? profiles[product.updated_by] : null;
              return (
                <div className="row" role="row" key={product.id}>
                  <div className="cell cell--product">
                    <Thumb product={product} />
                    <div className="product-meta">
                      <strong>{product.name}</strong>
                      <span>{product.sku}</span>
                      <span className="product-meta__actor">
                        {changedBy
                          ? t("table.updatedBy", { name: changedBy.display_name || changedBy.email })
                          : t("table.importedInventory")}
                      </span>
                    </div>
                  </div>
                  <div className="cell cell--category"><span className="chip">{t(`category.${product.category}`)}</span></div>
                  <div className="cell cell--price">{formatMoney(product.price, language)}</div>
                  <div className="cell cell--stock"><strong>{product.stock}</strong> <span className="muted">{t("table.units")}</span></div>
                  <div className="cell cell--status">
                    <span className={`badge badge--${productStatus}`}>
                      <i /> {t(`status.${productStatus}`)}
                    </span>
                  </div>
                  <div className="cell cell--actions">
                    <button className="icon-btn" aria-label={t("table.editProduct", { name: product.name })} onClick={() => openEdit(product)} disabled={!online}>
                      <Pencil size={18} />
                    </button>
                    <button className="icon-btn" aria-label={t("table.deleteProduct", { name: product.name })} onClick={() => handleDelete(product)} disabled={!online}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>}

        {page === "activity" && (
          <>
            <section className="card activity-summary" aria-labelledby="activity-summary-title">
              <div className="activity-card__head">
                <div>
                  <span className="eyebrow">{t("activity.team")}</span>
                  <h2 id="activity-summary-title">{t("activity.movements")}</h2>
                </div>
                <span className="muted small">{t("activity.movementTotals")}</span>
              </div>
              <div className="movement-stats">
                <button
                  type="button"
                  className={`movement-stat ${movementFilter === "in" ? "movement-stat--active" : ""}`}
                  aria-pressed={movementFilter === "in"}
                  onClick={() => setMovementFilter((filter) => filter === "in" ? "all" : "in")}
                >
                  <StatCard
                    tone="green"
                    icon={<ArrowDownLeft size={30} strokeWidth={2} />}
                    label={t("activity.itemsIn")}
                    value={movementTotals.items_in}
                    hint={t("activity.itemsInHint")}
                  />
                </button>
                <button
                  type="button"
                  className={`movement-stat ${movementFilter === "out" ? "movement-stat--active" : ""}`}
                  aria-pressed={movementFilter === "out"}
                  onClick={() => setMovementFilter((filter) => filter === "out" ? "all" : "out")}
                >
                  <StatCard
                    tone="amber"
                    icon={<ArrowUpRight size={30} strokeWidth={2} />}
                    label={t("activity.itemsOut")}
                    value={movementTotals.items_out}
                    hint={t("activity.itemsOutHint")}
                  />
                </button>
              </div>
            </section>

            <section className="card activity-card" aria-labelledby="activity-movements-title">
              <div className="activity-card__head activity-card__head--recent">
                <div>
                  <span className="eyebrow">{t("activity.team")}</span>
                  <h2 id="activity-movements-title">{t("activity.movementList")}</h2>
                  <span className="muted small">{t("activity.latestMovements")}</span>
                </div>
                <div className="movement-filters" role="group" aria-label={t("activity.filterMovements")}>
                  {["all", "in", "out"].map((filter) => (
                    <button
                      type="button"
                      className={`movement-filter ${movementFilter === filter ? "movement-filter--active" : ""}`}
                      aria-pressed={movementFilter === filter}
                      onClick={() => setMovementFilter(filter)}
                      key={filter}
                    >
                      {t(`activity.filter.${filter}`)}
                    </button>
                  ))}
                </div>
              </div>
              {visibleMovements.length === 0 ? (
                <div className="empty">
                  {movements.length === 0
                    ? t("activity.noMovements")
                    : t(`activity.noMovements.${movementFilter}`)}
                </div>
              ) : (
                <ol className="movement-list">
                  {visibleMovements.map((movement) => {
                    const actor = profiles[movement.actor_id];
                    const actorName = actor?.display_name || actor?.email || t("activity.unknownUser");
                    const occurredAt = new Date(movement.occurred_at);
                    const locale = language === "fr" ? "fr-FR" : "en-US";
                    const direction = movement.direction;
                    const MovementIcon = direction === "in" ? ArrowDownLeft : ArrowUpRight;
                    return (
                      <li className="movement-item" key={movement.id}>
                        <div className={`movement-item__icon movement-item__icon--${direction}`}>
                          <MovementIcon size={19} />
                        </div>
                        <div className="movement-item__body">
                          <div className="movement-item__product">
                            <strong>{movement.product_name}</strong>
                            {movement.sku && <span>{movement.sku}</span>}
                          </div>
                          <p>{t(`activity.units.${direction}`, { count: movement.quantity })}</p>
                          <p>{t("activity.stockLevel", { before: movement.stock_before, after: movement.stock_after })}</p>
                          <span className="movement-item__actor">{t("activity.changedBy", { name: actorName })}</span>
                        </div>
                        <time dateTime={movement.occurred_at}>
                          <span>{occurredAt.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}</span>
                          <span>{occurredAt.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</span>
                        </time>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}

        {page === "qr" && (
          <Suspense fallback={<p className="load-note" role="status">{t("qr.loading")}</p>}>
            <QrTools t={t} />
          </Suspense>
        )}
      </main>

      <ProductPanel
        open={panelOpen}
        product={editing}
        onClose={() => setPanelOpen(false)}
        onSave={handleSave}
        language={language}
        t={t}
      />
    </div>
  );
}
