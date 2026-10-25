import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Box,
  Clock3,
  DollarSign,
  Gamepad2,
  Headphones,
  Keyboard,
  Laptop,
  LogOut,
  Menu,
  Pencil,
  Plus,
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

const CATEGORY_ICON = {
  Computers: Laptop,
  Phones: Smartphone,
  Audio: Headphones,
  Accessories: Keyboard,
  Gaming: Gamepad2,
};

const ACTIVITY_FIELDS = [
  ["name", "activity.name"],
  ["sku", "activity.sku"],
  ["category", "activity.category"],
  ["price", "activity.price"],
  ["stock", "activity.stock"],
  ["photo_path", "activity.photo"],
];

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

function Sidebar({ open, user, profile, onNavigate, onActivity, onSignOut, t }) {
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
        <div className="brand__logo">
          <Box size={22} color="#fff" strokeWidth={1.8} />
        </div>
        <span className="brand__name">Voltstock</span>
      </div>
      <nav className="nav">
        <button className="nav__item nav__item--active" onClick={onNavigate}>
          <Box size={20} strokeWidth={1.8} />
          {t("nav.inventory")}
        </button>
        <button className="nav__item" onClick={onActivity}>
          <Activity size={20} strokeWidth={1.8} />
          {t("nav.activity")}
        </button>
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

function activityDetails(entry, language, t) {
  if (entry.operation === "INSERT") return t("activity.added");
  if (entry.operation === "DELETE") return t("activity.removed");
  const before = entry.before_data || {};
  const after = entry.after_data || {};
  return ACTIVITY_FIELDS
    .filter(([field]) => before[field] !== after[field])
    .map(([field, labelKey]) => {
      const label = t(labelKey);
      if (field === "price") return `${label}: ${formatMoney(Number(before[field]), language)} → ${formatMoney(Number(after[field]), language)}`;
      if (field === "photo_path") return t("activity.photoChanged");
      if (field === "category") {
        return `${label}: ${t(`category.${before[field]}`)} → ${t(`category.${after[field]}`)}`;
      }
      return `${label}: ${before[field]} → ${after[field]}`;
    })
    .join(" · ") || t("activity.productUpdated");
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
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "fr" ? "Voltstock · Inventaire" : "Voltstock · Inventory";
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
  }, [language]);

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
      setActivity([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("profiles").select("id,display_name,email"),
      supabase.from("inventory_activity")
        .select("id,product_id,product_name,operation,before_data,after_data,actor_id,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(100),
    ]).then(([productResult, profileResult, activityResult]) => {
      if (!active) return;
      const failed = [productResult, profileResult, activityResult].find((result) => result.error);
      if (failed) throw failed.error;
      setProducts((productResult.data || []).map((product) => ({
        ...product,
        price: Number(product.price),
        photo: getProductPhotoUrl(product.photo_path),
      })));
      setProfiles(Object.fromEntries((profileResult.data || []).map((profile) => [profile.id, profile])));
      setActivity(activityResult.data || []);
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

  const scrollToActivity = useCallback(() => {
    document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" });
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
        <span className="topbar__title">Voltstock</span>
        <LanguageSwitcher language={language} onChange={setLanguage} />
      </header>

      <Sidebar
        open={menuOpen}
        user={session.user}
        profile={currentProfile}
        t={t}
        onNavigate={() => setMenuOpen(false)}
        onActivity={scrollToActivity}
        onSignOut={handleSignOut}
      />
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <main className="main">
        <div className="page-head">
          <div>
            <span className="eyebrow">{t("page.storeOperations")}</span>
            <h1>{t("page.inventory")}</h1>
            <p className="muted">{t("page.sharedStock")}</p>
          </div>
          <div className="page-actions">
            <div className="page-language"><LanguageSwitcher language={language} onChange={setLanguage} /></div>
            <button className="btn btn--primary" onClick={openAdd} disabled={!online}>
              <Plus size={18} /> {t("page.addItem")}
            </button>
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

        <section className="card table-card">
          <div className="table-card__head">
            <h2>
              {t("table.allProducts")}{" "}
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
        </section>

        <section className="card activity-card" id="activity">
          <div className="activity-card__head">
            <div>
              <span className="eyebrow">{t("activity.team")}</span>
              <h2>{t("activity.recent")}</h2>
            </div>
            <span className="muted small">{t("activity.latest")}</span>
          </div>
          {activity.length === 0 ? (
            <div className="empty">{t("activity.empty")}</div>
          ) : (
            <ol className="activity-list">
              {activity.map((entry) => {
                const actor = profiles[entry.actor_id];
                const actorName = actor?.display_name || actor?.email || t("activity.unknownUser");
                return (
                  <li className="activity-item" key={entry.id}>
                    <div className="activity-item__icon"><Clock3 size={17} /></div>
                    <div className="activity-item__body">
                      <strong>{actorName}</strong>
                      {actor?.email && actor.email !== actorName && <span className="activity-item__email">{actor.email}</span>}
                      <p><b>{entry.product_name}</b> · {activityDetails(entry, language, t)}</p>
                    </div>
                    <time dateTime={entry.occurred_at}>
                      {new Date(entry.occurred_at).toLocaleString(language === "fr" ? "fr-FR" : "en-US")}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
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
