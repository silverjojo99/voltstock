export default function LanguageSwitcher({ language, onChange }) {
  return (
    <label className="language-switcher">
      <span className="sr-only">{language === "fr" ? "Langue" : "Language"}</span>
      <select
        aria-label={language === "fr" ? "Langue" : "Language"}
        value={language}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="en">English</option>
        <option value="fr">Français</option>
      </select>
    </label>
  );
}
