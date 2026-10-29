import { useEffect, useRef, useState } from "react";
import { X, ImagePlus } from "lucide-react";
import { CATEGORIES } from "./data.js";
import { translate } from "./i18n.js";

const MAX_BYTES = 15 * 1024 * 1024;
const empty = { name: "", sku: "", category: CATEGORIES[0], price: "", stock: "", photo: null, photoFile: null };

export default function ProductPanel({ open, product, onClose, onSave, language, t }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSaveError("");
    setForm(
      product
        ? { ...empty, ...product, price: String(product.price), stock: String(product.stock) }
        : empty
    );
    const t = setTimeout(() => nameRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [open, product]);

  useEffect(() => {
    if (form.photo?.startsWith("blob:")) return () => URL.revokeObjectURL(form.photo);
    return undefined;
  }, [form.photo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => !saving && e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, saving]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setErrors((er) => ({ ...er, photo: t("panel.photoTooLarge") }));
      e.target.value = "";
      return;
    }
    setErrors((er) => ({ ...er, photo: undefined }));
    setForm((f) => ({ ...f, photo: URL.createObjectURL(file), photoFile: file }));
    e.target.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = t("panel.enterName");
    if (!form.sku.trim()) next.sku = t("panel.enterSku");
    if (form.price === "" || !Number.isFinite(Number(form.price)) || Number(form.price) < 0)
      next.price = t("panel.validPrice");
    if (form.stock === "" || Number(form.stock) < 0 || !Number.isInteger(Number(form.stock)))
      next.stock = t("panel.wholeNumber");
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSave({
        name: form.name.trim(),
        sku: form.sku.trim().toUpperCase(),
        category: form.category,
        price: Number(form.price),
        stock: Number(form.stock),
        photoFile: form.photoFile,
      });
    } catch (error) {
      setSaveError(error.message || t("panel.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`overlay ${open ? "overlay--open" : ""}`} onClick={saving ? undefined : onClose} aria-hidden="true" />
      <aside
        className={`panel ${open ? "panel--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={product ? t("panel.editProduct") : t("panel.addProduct")}
        aria-hidden={!open}
      >
        <form onSubmit={submit} className="panel__form" noValidate>
          <header className="panel__head">
            <div>
              <span className="eyebrow">{product ? t("panel.editInventory") : t("panel.newInventory")}</span>
              <h2>{product ? t("panel.editProduct") : t("panel.addProduct")}</h2>
            </div>
            <button type="button" className="icon-btn" aria-label={t("panel.close")} onClick={onClose} disabled={saving}>
              <X size={26} strokeWidth={1.6} />
            </button>
          </header>

          <div className="panel__body">
            <div className="field">
              <span className="field__label">{t("panel.photo")}</span>
              <div className="dropzone">
                <div className="dropzone__preview">
                  {form.photo ? <img src={form.photo} alt={t("panel.photoPreview")} /> : <ImagePlus size={32} strokeWidth={1.5} />}
                </div>
                <div className="dropzone__text">
                  <strong>{t("panel.addPhoto")}</strong>
                  <span>{t("panel.photoTypes")}</span>
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => fileRef.current?.click()}>
                    {t("panel.choosePhoto")}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/heic,image/webp"
                    hidden
                    onChange={onPhoto}
                  />
                </div>
              </div>
              {errors.photo && <span className="field__error">{errors.photo}</span>}
            </div>

            <label className="field">
              <span className="field__label">{t("panel.productName")}</span>
              <input
                ref={nameRef}
                className={errors.name ? "invalid" : ""}
                placeholder={t("panel.namePlaceholder")}
                value={form.name}
                onChange={set("name")}
              />
              {errors.name && <span className="field__error">{errors.name}</span>}
            </label>

            <div className="grid-2">
              <label className="field">
                <span className="field__label">{t("panel.sku")}</span>
                <input
                  className={errors.sku ? "invalid" : ""}
                  placeholder="ACC-00001"
                  value={form.sku}
                  onChange={set("sku")}
                />
                {errors.sku && <span className="field__error">{errors.sku}</span>}
              </label>
              <label className="field">
                <span className="field__label">{t("panel.category")}</span>
                <select value={form.category} onChange={set("category")}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{translate(language, `category.${c}`)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid-2">
              <label className="field">
                <span className="field__label">{t("panel.retailPrice")}</span>
                <div className="prefix">
                  <span>DH</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className={errors.price ? "invalid" : ""}
                    placeholder="0.00"
                    value={form.price}
                    onChange={set("price")}
                  />
                </div>
                {errors.price && <span className="field__error">{errors.price}</span>}
              </label>
              <label className="field">
                <span className="field__label">{t("panel.currentStock")}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  className={errors.stock ? "invalid" : ""}
                  placeholder="0"
                  value={form.stock}
                  onChange={set("stock")}
                />
                {errors.stock && <span className="field__error">{errors.stock}</span>}
              </label>
            </div>
          </div>

          <footer className="panel__foot">
            {saveError && <span className="field__error panel__save-error" role="alert">{saveError}</span>}
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
              {t("panel.cancel")}
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? t("panel.saving") : product ? t("panel.saveChanges") : t("panel.addProduct")}
            </button>
          </footer>
        </form>
      </aside>
    </>
  );
}
