import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import {
  House,
  Heart,
  Pencil,
  UtensilsCrossed,
  CalendarDays,
  Shuffle,
  Plus,
  X,
  Trash2,
  Search,
  Tags,
  Flame,
  Beef,
  ShoppingBasket,
  Check,
  RotateCcw,
  ChefHat,
  Image as ImageIcon,
  AlertCircle,
  Settings,
} from "lucide-react";

const TAG_OPTIONS = ["breakfast", "lunch", "dinner", "snack", "high-protein", "quick", "batch"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MEALS_KEY = "meal-index:meals";
const PLAN_KEY = "meal-index:weeklyPlan";
const CHECKED_KEY = "meal-index:groceryChecked";
const LOG_KEY = "meal-index:cookLog";
const ESSENTIALS_KEY = "meal-index:essentials";
const EXTRAS_KEY = "meal-index:groceryExtras";
const PREFS_KEY = "meal-index:preferences";

const DEFAULT_PREFS = { weekStart: "mon", theme: "auto", units: "metric" };

const THEME_VARS = {
  light: { "--page-bg": "#FDF0DC", "--card-bg": "#FFFFFF", "--ink": "#171717", "--muted": "#6b645e", "--line": "#d9d4cc" },
  dark: { "--page-bg": "#1C1917", "--card-bg": "#292524", "--ink": "#F5F5F4", "--muted": "#a8a29e", "--line": "#57534e" },
};

function gToOz(g) {
  return Math.round(g * 0.035274 * 10) / 10;
}
function ozToG(oz) {
  return Math.round(oz / 0.035274);
}
function orderedDays(weekStart) {
  // DAYS/data are always Monday-indexed (0=Mon...6=Sun) so stored plans never
  // change meaning — this only reorders how they're displayed.
  if (weekStart === "sun") {
    return [6, 0, 1, 2, 3, 4, 5].map((i) => ({ label: DAYS[i], idx: i }));
  }
  return DAYS.map((label, i) => ({ label, idx: i }));
}

const INK = "#171717";

// Loud, saturated, one distinct color per category — this is where the
// app's personality lives.
const TAG_COLORS = {
  breakfast: { bg: "#FFD23F", ink: INK },
  lunch: { bg: "#FF5A5F", ink: "#FFFFFF" },
  dinner: { bg: "#8338EC", ink: "#FFFFFF" },
  snack: { bg: "#06A77D", ink: "#FFFFFF" },
  "high-protein": { bg: "#FB8B24", ink: INK },
  quick: { bg: "#3A86FF", ink: "#FFFFFF" },
  batch: { bg: "#FF206E", ink: "#FFFFFF" },
};

const SECTION = {
  home: { name: "Home", short: "Home", color: "#3A86FF", ink: "#FFFFFF" },
  index: { name: "My Meals", short: "Meals", color: "#FF5A5F", ink: "#FFFFFF" },
  plan: { name: "Weekly Plan", short: "Plan", color: "#06A77D", ink: "#FFFFFF" },
  groceries: { name: "Groceries", short: "Groceries", color: "#FF206E", ink: "#FFFFFF" },
  surprise: { name: "Surprise Me", short: "Surprise", color: "#FFD23F", ink: INK },
  pantry: { name: "What Can I Make", short: "Pantry", color: "#8338EC", ink: "#FFFFFF" },
};

const TAB_ICONS = {
  home: House,
  index: UtensilsCrossed,
  plan: CalendarDays,
  groceries: ShoppingBasket,
  surprise: Shuffle,
  pantry: Search,
};

const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const STAMP_ROTATIONS = ["-8deg", "6deg", "-4deg", "9deg", "-6deg"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function normalize(s) {
  return s.trim().toLowerCase();
}
function todayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}
function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysSince(dateStr) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr + "T00:00:00").getTime();
  return Math.floor(ms / 86400000);
}
function formatShortDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function resizeImage(file, maxWidth = 480) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function tagColor(tag) {
  return TAG_COLORS[tag] || { bg: INK, ink: "#FFFFFF" };
}

const display = { fontFamily: "'Baloo 2', system-ui, sans-serif" };

function pop(offset = 4) {
  return { boxShadow: `${offset}px ${offset}px 0 var(--ink)` };
}

function Stamp({ tag, rotate = "-6deg", size = "md" }) {
  const c = tagColor(tag);
  const long = tag.length > 8;
  const dims =
    size === "sm"
      ? `w-14 h-14 ${long ? "text-[7.5px] tracking-tight" : "text-[9px]"}`
      : `w-16 h-16 ${long ? "text-[8.5px] tracking-tight" : "text-[10px]"}`;
  return (
    <div
      className={`${dims} rounded-full flex items-center justify-center text-center font-bold uppercase leading-tight px-1 shrink-0`}
      style={{
        backgroundColor: c.bg,
        color: c.ink,
        border: `2.5px solid var(--ink)`,
        transform: `rotate(${rotate})`,
        ...display,
      }}
    >
      {tag}
    </div>
  );
}

function TagPill({ tag }) {
  const c = tagColor(tag);
  return (
    <span
      className="inline-block text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: c.bg, color: c.ink, border: `1.5px solid var(--ink)` }}
    >
      {tag}
    </span>
  );
}

function MealCard({ meal, onDelete, onEdit, onToggleFav, rotate, units = "metric" }) {
  const primary = meal.tags[0];
  const band = primary ? tagColor(primary).bg : "var(--ink)";
  const proteinDisplay =
    meal.protein != null ? (units === "imperial" ? `${gToOz(meal.protein)}oz` : `${meal.protein}g`) : null;
  const hasMacros = meal.calories || meal.protein;
  return (
    <div
      className="relative rounded-2xl"
      style={{ border: `2.5px solid var(--ink)`, backgroundColor: "var(--card-bg)", ...pop(4) }}
    >
      {primary && (
        <div className="absolute -top-4 -right-3 z-10">
          <Stamp tag={primary} rotate={STAMP_ROTATIONS[rotate % STAMP_ROTATIONS.length]} size="sm" />
        </div>
      )}
      {meal.photo ? (
        <div
          className="w-full h-36 overflow-hidden rounded-t-[13px]"
          style={{ borderBottom: `2.5px solid var(--ink)` }}
        >
          <img src={meal.photo} alt={meal.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div
          className="h-3 rounded-t-[13px]"
          style={{ backgroundColor: band, borderBottom: `2.5px solid var(--ink)` }}
        />
      )}
      <div className="px-4 pt-3.5 pb-4">
        <h3
          className="text-xl font-bold leading-tight pr-12"
          style={{ ...display, color: "var(--ink)" }}
        >
          {meal.name}
        </h3>
        {meal.ingredients.length > 0 && (
          <p className="text-[13px] text-[color:var(--muted)] mt-1.5 leading-snug">
            {meal.ingredients.join(", ")}
          </p>
        )}
        {(meal.tags.length > 1 || hasMacros) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {meal.tags.slice(1).map((t) => (
              <TagPill key={t} tag={t} />
            ))}
            {hasMacros && (
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)] ml-1">
                {meal.calories ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Flame size={12} /> {meal.calories}
                  </span>
                ) : null}
                {meal.protein ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Beef size={12} /> {proteinDisplay}
                  </span>
                ) : null}
              </span>
            )}
          </div>
        )}
        {(onToggleFav || onEdit || onDelete) && (
          <div className="flex items-center justify-between mt-2 -mb-1.5">
            {onToggleFav ? (
              <button
                onClick={() => onToggleFav(meal.id)}
                className="w-10 h-10 -ml-2.5 rounded-full flex items-center justify-center transition-transform active:scale-90"
                aria-label={meal.favorite ? `Remove ${meal.name} from favorites` : `Favorite ${meal.name}`}
                aria-pressed={!!meal.favorite}
              >
                <Heart
                  size={22}
                  strokeWidth={2.25}
                  fill={meal.favorite ? "#FF206E" : "none"}
                  color={meal.favorite ? "#FF206E" : "var(--muted)"}
                />
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center -mr-2.5">
              {onEdit && (
                <button
                  onClick={() => onEdit(meal.id)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors"
                  aria-label={`Edit ${meal.name}`}
                >
                  <Pencil size={17} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(meal.id)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[color:var(--muted)] hover:text-[#FF5A5F] transition-colors"
                  aria-label={`Delete ${meal.name}`}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children, color = "var(--ink)" }) {
  return (
    <p className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[color:var(--muted)] mb-3">
      <span
        className="w-2.5 h-2.5 rounded-[3px] shrink-0"
        style={{ backgroundColor: color, border: "1.5px solid var(--ink)", transform: "rotate(12deg)" }}
      />
      {children}
    </p>
  );
}

function LoadingScreen({ text, themeVars }) {
  return (
    <div
      className="w-full min-h-[100dvh] flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: "var(--page-bg)", ...themeVars }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap');
        @keyframes floatY { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-8px) rotate(-6deg); } }
      `}</style>
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: "#FFD23F",
          border: "3px solid var(--ink)",
          boxShadow: "4px 4px 0 var(--ink)",
          animation: "floatY 1.6s ease-in-out infinite",
        }}
      >
        <ChefHat size={30} color={INK} />
      </div>
      <p className="text-sm font-bold text-[color:var(--muted)]" style={display}>
        {text}
      </p>
    </div>
  );
}

function AddMealForm({ onAdd, onSave, initial, onClose, units = "metric" }) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [ingredientsText, setIngredientsText] = useState(initial ? initial.ingredients.join(", ") : "");
  const [tags, setTags] = useState(initial?.tags || []);
  const [calories, setCalories] = useState(initial?.calories ?? "");
  const [protein, setProtein] = useState(
    initial?.protein != null ? (units === "imperial" ? gToOz(initial.protein) : initial.protein) : ""
  );
  const [photo, setPhoto] = useState(initial?.photo || null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const toggleTag = (t) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const dataUrl = await resizeImage(file);
      setPhoto(dataUrl);
    } catch (err) {
      console.error("Photo processing failed:", err);
    } finally {
      setPhotoLoading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    // Protein is always stored in grams internally, regardless of which unit
    // the person typed it in — so switching units later never changes the data.
    const proteinGrams = protein
      ? units === "imperial"
        ? ozToG(Number(protein))
        : Number(protein)
      : null;
    const fields = {
      name: name.trim(),
      ingredients: ingredientsText.split(",").map((i) => i.trim()).filter(Boolean),
      tags,
      calories: calories ? Number(calories) : null,
      protein: proteinGrams,
      photo,
    };
    if (editing) {
      onSave({ ...initial, ...fields });
      onClose();
      return;
    }
    onAdd({ id: uid(), ...fields });
    setName("");
    setIngredientsText("");
    setTags([]);
    setCalories("");
    setProtein("");
    setPhoto(null);
    onClose();
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl p-5 mb-5 relative"
      style={{ border: `2.5px solid var(--ink)`, backgroundColor: "var(--card-bg)", ...pop(5) }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-[color:var(--muted)] hover:text-white hover:bg-[#171717] transition-colors"
        style={{ border: `2px solid var(--ink)` }}
      >
        <X size={14} />
      </button>
      <p className="text-sm uppercase tracking-widest font-bold text-[#FF5A5F] mb-3">{editing ? "Edit meal" : "New meal"}</p>
      <div className="space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold">
            Meal name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Turkey chili"
            className="w-full mt-1 bg-transparent border-b-[3px] border-[color:var(--line)] text-lg py-1 focus:outline-none focus:border-[#FF5A5F]"
            style={display}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold">
            Ingredients (comma separated)
          </label>
          <input
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            placeholder="ground turkey, kidney beans, canned tomato, onion"
            className="w-full mt-1 bg-transparent border-b border-[color:var(--line)] text-sm py-1 focus:outline-none focus:border-[#FF5A5F]"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold">
              Calories
            </label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full mt-1 bg-transparent border-b border-[color:var(--line)] text-sm py-1 focus:outline-none focus:border-[#FF5A5F]"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold">
              Protein ({units === "imperial" ? "oz" : "g"})
            </label>
            <input
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="w-full mt-1 bg-transparent border-b border-[color:var(--line)] text-sm py-1 focus:outline-none focus:border-[#FF5A5F]"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold flex items-center gap-1">
            <ImageIcon size={10} /> Photo (optional)
          </label>
          <div className="flex items-center gap-3 mt-1.5">
            {photo ? (
              <img
                src={photo}
                alt="Preview"
                className="w-14 h-14 rounded-lg object-cover"
                style={{ border: `2px solid var(--ink)` }}
              />
            ) : (
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center text-stone-300"
                style={{ border: `2px dashed var(--line)` }}
              >
                <ImageIcon size={18} />
              </div>
            )}
            <label
              className="text-[10px] uppercase tracking-wide font-bold px-3 py-2 rounded-full cursor-pointer"
              style={{ backgroundColor: "var(--card-bg)", color: "var(--ink)", border: `2px solid var(--ink)` }}
            >
              {photoLoading ? "Processing…" : photo ? "Change photo" : "Upload photo"}
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
            {photo && (
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="text-stone-300 hover:text-red-500"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-[color:var(--muted)] font-bold flex items-center gap-1">
            <Tags size={10} /> Tags
          </label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {TAG_OPTIONS.map((t) => {
              const c = tagColor(t);
              const active = tags.includes(t);
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => toggleTag(t)}
                  className="text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-full transition-transform"
                  style={{
                    backgroundColor: c.bg,
                    color: c.ink,
                    border: `2px solid var(--ink)`,
                    opacity: active ? 1 : 0.72,
                    transform: active ? "scale(1.06)" : "scale(1)",
                    ...(active ? pop(2) : {}),
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="submit"
          className="text-sm uppercase tracking-widest font-bold text-white px-6 py-2.5 rounded-full"
          style={{ backgroundColor: "#FF5A5F", border: `2.5px solid var(--ink)`, ...pop(3), ...display }}
        >
          {editing ? "Save changes" : "Add to index"}
        </button>
      </div>
    </form>
  );
}

function HomeScreen({ meals, plan, setTab, onToggleFav, weekStart, units }) {
  const tIdx = todayIndex();
  const accent = SECTION.home.color;
  const days = orderedDays(weekStart);

  const mealById = useMemo(() => {
    const m = {};
    meals.forEach((meal) => (m[meal.id] = meal));
    return m;
  }, [meals]);

  const todayMeals = (plan[tIdx] || []).map((id) => mealById[id]).filter(Boolean);
  const plannedCount = Object.values(plan).reduce((acc, ids) => acc + (ids?.length || 0), 0);
  const todayLabel = FULL_DAYS[tIdx];
  const dateLabel = new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" });

  const staples = useMemo(() => {
    const counts = {};
    meals.forEach((m) =>
      m.ingredients.forEach((ing) => {
        const key = normalize(ing);
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
      })
    );
    return Object.entries(counts)
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [meals]);

  const pill = (bg, fg) => ({
    backgroundColor: bg,
    color: fg,
    border: "2px solid var(--ink)",
    ...pop(3),
  });

  return (
    <div>
      {/* Greeting */}
      <div className="mb-7">
        <p className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: accent }}>
          {greeting()}
        </p>
        <h2
          className="text-[32px] sm:text-4xl font-extrabold leading-[1.05]"
          style={{ ...display, color: "var(--ink)" }}
        >
          {todayLabel},
          <br />
          {dateLabel}
        </h2>
      </div>

      {/* Today's spotlight */}
      <div className="mb-8">
        <SectionLabel color={SECTION.index.color}>On the menu today</SectionLabel>
        {meals.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ border: "2.5px dashed var(--line)", backgroundColor: "var(--card-bg)" }}
          >
            <p className="font-bold text-lg leading-tight mb-1" style={{ ...display, color: "var(--ink)" }}>
              Your kitchen is empty
            </p>
            <p className="text-[color:var(--muted)] text-sm mb-4">
              File a few meal ideas and the rest of the app fills in around them.
            </p>
            <button
              onClick={() => setTab("index")}
              className="text-xs uppercase tracking-widest font-bold px-5 py-2.5 rounded-full active:translate-y-px"
              style={pill(SECTION.index.color, "#fff")}
            >
              Add your first meal
            </button>
          </div>
        ) : todayMeals.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ border: "2.5px dashed var(--line)", backgroundColor: "var(--card-bg)" }}
          >
            <p className="font-bold text-lg leading-tight mb-1" style={{ ...display, color: "var(--ink)" }}>
              Nothing planned for today
            </p>
            <p className="text-[color:var(--muted)] text-sm mb-4">Pick something or let the deck decide.</p>
            <div className="flex gap-2.5 justify-center flex-wrap">
              <button
                onClick={() => setTab("surprise")}
                className="text-xs uppercase tracking-widest font-bold px-5 py-2.5 rounded-full active:translate-y-px"
                style={pill(SECTION.surprise.color, SECTION.surprise.ink)}
              >
                Surprise me
              </button>
              <button
                onClick={() => setTab("plan")}
                className="text-xs uppercase tracking-widest font-bold px-5 py-2.5 rounded-full active:translate-y-px"
                style={pill("var(--card-bg)", "var(--ink)")}
              >
                Plan my week
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {todayMeals.map((meal, i) => (
              <MealCard
                key={meal.id}
                meal={meal}
                onDelete={null}
                rotate={i}
                onToggleFav={onToggleFav}
                units={units}
              />
            ))}
          </div>
        )}
      </div>

      {/* Week strip */}
      <div className="mb-8">
        <SectionLabel color={SECTION.plan.color}>This week</SectionLabel>
        <button
          onClick={() => setTab("plan")}
          className="w-full grid grid-cols-7 gap-1.5 sm:gap-2"
          aria-label="Open weekly plan"
        >
          {days.map(({ label, idx }) => {
            const count = (plan[idx] || []).length;
            const first = count > 0 ? mealById[plan[idx][0]] : null;
            const dotColor = first ? tagColor(first.tags[0]).bg : "transparent";
            const isToday = idx === tIdx;
            return (
              <div
                key={idx}
                className="flex flex-col items-center gap-2 pt-2.5 pb-3 rounded-xl"
                style={{
                  border: `2px solid ${isToday ? "var(--ink)" : "var(--line)"}`,
                  backgroundColor: isToday ? accent : "var(--card-bg)",
                  ...(isToday ? pop(2) : {}),
                }}
              >
                <span
                  className="text-[10px] sm:text-[11px] uppercase tracking-wide font-bold"
                  style={{ color: isToday ? "#fff" : "var(--muted)" }}
                >
                  {label}
                </span>
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold"
                  style={{
                    backgroundColor: dotColor,
                    color: first ? tagColor(first.tags[0]).ink : "transparent",
                    border: count > 0 ? "1.5px solid var(--ink)" : `1.5px dashed ${isToday ? "#ffffffaa" : "var(--line)"}`,
                  }}
                >
                  {count > 1 ? count : ""}
                </span>
              </div>
            );
          })}
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-xl px-4 py-3.5"
          style={{ border: "2.5px solid var(--ink)", backgroundColor: "#FFD23F", ...pop(3) }}
        >
          <p className="text-3xl font-extrabold leading-none" style={{ ...display, color: INK }}>
            {meals.length}
          </p>
          <p className="text-[11px] uppercase tracking-widest font-bold mt-1.5" style={{ color: INK }}>
            meals filed
          </p>
        </div>
        <div
          className="rounded-xl px-4 py-3.5"
          style={{ border: "2.5px solid var(--ink)", backgroundColor: "#8338EC", ...pop(3) }}
        >
          <p className="text-3xl font-extrabold leading-none text-white" style={display}>
            {plannedCount}
          </p>
          <p className="text-[11px] uppercase tracking-widest font-bold mt-1.5 text-white">
            planned this week
          </p>
        </div>
      </div>

      {staples.length > 0 && (
        <div className="mt-8">
          <SectionLabel color={SECTION.groceries.color}>Your staples</SectionLabel>
          <p className="text-xs text-[color:var(--muted)] -mt-1 mb-3">
            Ingredients that show up again and again, worth always having stocked.
          </p>
          <div className="flex flex-wrap gap-2">
            {staples.map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 text-xs font-bold capitalize pl-3 pr-1.5 py-1.5 rounded-full"
                style={{ backgroundColor: "var(--card-bg)", color: "var(--ink)", border: "2px solid var(--ink)" }}
              >
                {name}
                <span
                  className="text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center"
                  style={{ backgroundColor: accent, color: "#fff" }}
                >
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MealPicker({ meals, assignedIds, dayLabel, onPick, onClose }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const list = useMemo(() => {
    const n = normalize(q);
    const f = !n
      ? meals
      : meals.filter(
          (m) =>
            normalize(m.name).includes(n) ||
            m.ingredients.some((i) => normalize(i).includes(n)) ||
            m.tags.some((t) => t.includes(n))
        );
    return [...f].sort(
      (a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || a.name.localeCompare(b.name)
    );
  }, [meals, q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center px-4 pt-10 sm:pt-0"
      style={{ backgroundColor: "rgba(23,23,23,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-2xl flex flex-col max-h-[70dvh]"
        style={{ border: "3px solid var(--ink)", backgroundColor: "var(--card-bg)", ...pop(5) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h3 className="text-xl font-extrabold" style={{ ...display, color: "var(--ink)" }}>
            Add to {dayLabel}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ border: "2px solid var(--ink)", color: "var(--ink)" }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-4 pb-3">
          <div
            className="flex items-center gap-2 rounded-full px-3.5 py-2.5"
            style={{ border: "2px solid var(--ink)", backgroundColor: "var(--page-bg)" }}
          >
            <Search size={16} color="var(--muted)" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search meals or ingredients"
              className="flex-1 min-w-0 bg-transparent text-base focus:outline-none"
              style={{ color: "var(--ink)" }}
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search" style={{ color: "var(--muted)" }}>
                <X size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-y-auto px-2 pb-3" style={{ borderTop: "1.5px dashed var(--line)" }}>
          {list.length === 0 && (
            <p className="text-sm text-[color:var(--muted)] text-center py-8">No meals match "{q}".</p>
          )}
          {list.map((m) => {
            const added = assignedIds.includes(m.id);
            const c = tagColor(m.tags[0]);
            return (
              <button
                key={m.id}
                disabled={added}
                onClick={() => onPick(m.id)}
                className="w-full flex items-center gap-3 text-left px-2.5 py-3 rounded-xl disabled:opacity-50"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: m.tags[0] ? c.bg : "var(--line)", border: "1.5px solid var(--ink)" }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block font-bold leading-tight truncate" style={{ ...display, color: "var(--ink)" }}>
                    {m.name}
                  </span>
                  {m.ingredients.length > 0 && (
                    <span className="block text-xs text-[color:var(--muted)] truncate mt-0.5">
                      {m.ingredients.join(", ")}
                    </span>
                  )}
                </span>
                {m.favorite && <Heart size={14} fill="#FF206E" color="#FF206E" className="shrink-0" />}
                {added && <Check size={16} color="#06A77D" className="shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeeklyPlanner({ meals, plan, setPlan, weekStart }) {
  const [pickerDay, setPickerDay] = useState(null);
  const tIdx = todayIndex();
  const accent = SECTION.plan.color;
  const days = orderedDays(weekStart);

  const assignMeal = (dayIdx, mealId) => {
    if (!mealId) return;
    setPlan((prev) => {
      const list = prev[dayIdx] || [];
      if (list.includes(mealId)) return prev;
      return { ...prev, [dayIdx]: [...list, mealId] };
    });
  };
  const removeMeal = (dayIdx, mealId) =>
    setPlan((prev) => ({ ...prev, [dayIdx]: (prev[dayIdx] || []).filter((id) => id !== mealId) }));
  const clearWeek = () => setPlan({});

  const mealById = useMemo(() => {
    const m = {};
    meals.forEach((meal) => (m[meal.id] = meal));
    return m;
  }, [meals]);

  const plannedCount = Object.values(plan).reduce((acc, ids) => acc + (ids?.length || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[color:var(--muted)]">
          {plannedCount} meal{plannedCount === 1 ? "" : "s"} planned this week
        </p>
        <button
          onClick={clearWeek}
          className="flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors"
        >
          <RotateCcw size={12} /> Start new week
        </button>
      </div>

      {meals.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)] text-center py-14">
          File a few meals on "My Meals" first, then come plan your week.
        </p>
      ) : (
        <div className="space-y-2">
          {days.map(({ label, idx }) => {
            const assigned = plan[idx] || [];
            const isToday = idx === tIdx;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 flex-wrap p-2.5 rounded-xl"
                style={{
                  border: `2px solid ${isToday ? accent : "var(--line)"}`,
                  backgroundColor: isToday ? `${accent}1A` : "var(--card-bg)",
                }}
              >
                <span
                  className="text-xs uppercase tracking-widest font-bold w-10 shrink-0"
                  style={{ color: isToday ? accent : "#a8a29e", ...display }}
                >
                  {label}
                </span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {assigned.map((id) => {
                    const meal = mealById[id];
                    if (!meal) return null;
                    const c = tagColor(meal.tags[0]);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: c.bg, color: c.ink, border: `1.5px solid var(--ink)` }}
                      >
                        {meal.name}
                        <button onClick={() => removeMeal(idx, id)} className="hover:opacity-70">
                          <X size={11} />
                        </button>
                      </span>
                    );
                  })}
                  <button
                    onClick={() => setPickerDay(idx)}
                    className="inline-flex items-center gap-1 text-xs font-bold rounded-full px-3 py-1.5 text-[color:var(--muted)]"
                    style={{ border: "1.5px dashed var(--muted)" }}
                  >
                    <Plus size={12} /> add meal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pickerDay !== null && (
        <MealPicker
          meals={meals}
          assignedIds={plan[pickerDay] || []}
          dayLabel={FULL_DAYS[pickerDay]}
          onPick={(id) => {
            assignMeal(pickerDay, id);
            setPickerDay(null);
          }}
          onClose={() => setPickerDay(null)}
        />
      )}
    </div>
  );
}

function GroceriesScreen({
  meals,
  plan,
  checked,
  setChecked,
  essentials,
  setEssentials,
  extras,
  setExtras,
}) {
  const accent = SECTION.groceries.color;
  const [newEssential, setNewEssential] = useState("");
  const [newExtra, setNewExtra] = useState("");

  const mealById = useMemo(() => {
    const m = {};
    meals.forEach((meal) => (m[meal.id] = meal));
    return m;
  }, [meals]);

  const planList = useMemo(() => {
    const counts = {};
    Object.values(plan).forEach((ids) =>
      (ids || []).forEach((id) => {
        const meal = mealById[id];
        if (!meal) return;
        meal.ingredients.forEach((ing) => {
          const key = normalize(ing);
          if (!key) return;
          counts[key] = (counts[key] || 0) + 1;
        });
      })
    );
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [plan, mealById]);

  const sortedEssentials = useMemo(
    () =>
      [...essentials].sort((a, b) => {
        const da = daysSince(a.lastBought);
        const db = daysSince(b.lastBought);
        if (da === null && db === null) return 0;
        if (da === null) return -1;
        if (db === null) return 1;
        return db - da;
      }),
    [essentials]
  );

  const addEssential = (e) => {
    e.preventDefault();
    if (!newEssential.trim()) return;
    setEssentials((prev) => [...prev, { id: uid(), name: newEssential.trim(), lastBought: null }]);
    setNewEssential("");
  };
  const removeEssential = (id) => setEssentials((prev) => prev.filter((x) => x.id !== id));
  const toggleEssential = (item) => {
    const key = `essential:${item.id}`;
    const willCheck = !checked[key];
    setChecked((prev) => ({ ...prev, [key]: willCheck }));
    if (willCheck) {
      setEssentials((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, lastBought: todayDateStr() } : x))
      );
    }
  };

  const addExtra = (e) => {
    e.preventDefault();
    if (!newExtra.trim()) return;
    setExtras((prev) => [...prev, { id: uid(), name: newExtra.trim() }]);
    setNewExtra("");
  };
  const removeExtra = (id) => {
    setExtras((prev) => prev.filter((x) => x.id !== id));
    setChecked((prev) => {
      const next = { ...prev };
      delete next[`extra:${id}`];
      return next;
    });
  };

  const Checkbox = ({ isChecked, onClick }) => (
    <button
      onClick={onClick}
      className="w-5 h-5 shrink-0 rounded-md flex items-center justify-center transition-colors"
      style={{ border: `2px solid var(--ink)`, backgroundColor: isChecked ? accent : "var(--card-bg)" }}
    >
      {isChecked && <Check size={13} strokeWidth={3} className="text-white" />}
    </button>
  );

  return (
    <div>
      {/* Section 1: from the plan */}
      <div className="mb-8">
        <h3
          className="flex items-center gap-1.5 text-sm uppercase tracking-widest font-bold mb-1"
          style={{ color: "var(--ink)", ...display }}
        >
          <ShoppingBasket size={16} /> From your meal plan
        </h3>
        <p className="text-xs text-[color:var(--muted)] mb-3">Auto-filled from Weekly Plan.</p>
        {planList.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">Nothing planned this week yet.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {planList.map((item) => {
              const isChecked = !!checked[`plan:${item.name}`];
              return (
                <li key={item.name} className="flex items-center gap-2 py-1.5">
                  <Checkbox
                    isChecked={isChecked}
                    onClick={() =>
                      setChecked((prev) => ({
                        ...prev,
                        [`plan:${item.name}`]: !prev[`plan:${item.name}`],
                      }))
                    }
                  />
                  <span
                    className={`text-sm capitalize transition-colors ${
                      isChecked ? "line-through text-stone-300" : "text-[color:var(--ink)]"
                    }`}
                  >
                    {item.name}
                    {item.count > 1 && (
                      <span className="text-[color:var(--muted)] font-normal">
                        {" "}
                        · needed for {item.count} meals
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Section 2: essentials / time to restock */}
      <div className="mb-8 pt-6" style={{ borderTop: `2px dashed var(--line)` }}>
        <h3
          className="flex items-center gap-1.5 text-sm uppercase tracking-widest font-bold mb-1"
          style={{ color: "var(--ink)", ...display }}
        >
          <AlertCircle size={16} /> Time to restock
        </h3>
        <p className="text-xs text-[color:var(--muted)] mb-3">
          Your recurring essentials — checking one off logs today as the last time you bought it.
        </p>

        {sortedEssentials.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {sortedEssentials.map((item) => {
              const isChecked = !!checked[`essential:${item.id}`];
              const d = daysSince(item.lastBought);
              const overdue = d === null || d >= 10;
              return (
                <li key={item.id} className="flex items-center gap-2 group">
                  <Checkbox isChecked={isChecked} onClick={() => toggleEssential(item)} />
                  <span
                    className={`text-sm capitalize flex-1 ${
                      isChecked ? "line-through text-stone-300" : "text-[color:var(--ink)]"
                    }`}
                  >
                    {item.name}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: overdue ? "#FEE2E2" : "#f5f5f4",
                      color: overdue ? "#B91C1C" : "#a8a29e",
                    }}
                  >
                    {d === null ? "never bought" : `${d}d ago`}
                  </span>
                  <button
                    onClick={() => removeEssential(item.id)}
                    className="text-stone-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={addEssential} className="flex gap-2">
          <input
            value={newEssential}
            onChange={(e) => setNewEssential(e.target.value)}
            placeholder="eggs, jelly, coffee…"
            className="flex-1 bg-transparent border-b-2 border-[color:var(--line)] text-sm py-1.5 focus:outline-none focus:border-[#FF206E]"
          />
          <button
            type="submit"
            className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: accent, color: "#fff", border: `2px solid var(--ink)` }}
          >
            <Plus size={13} />
          </button>
        </form>
      </div>

      {/* Section 3: add your own */}
      <div className="pt-6" style={{ borderTop: `2px dashed var(--line)` }}>
        <h3
          className="flex items-center gap-1.5 text-sm uppercase tracking-widest font-bold mb-1"
          style={{ color: "var(--ink)", ...display }}
        >
          <Plus size={16} /> Add your own
        </h3>
        <p className="text-xs text-[color:var(--muted)] mb-3">One-off items just for this trip.</p>

        {extras.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {extras.map((item) => {
              const isChecked = !!checked[`extra:${item.id}`];
              return (
                <li key={item.id} className="flex items-center gap-2 group">
                  <Checkbox
                    isChecked={isChecked}
                    onClick={() =>
                      setChecked((prev) => ({
                        ...prev,
                        [`extra:${item.id}`]: !prev[`extra:${item.id}`],
                      }))
                    }
                  />
                  <span
                    className={`text-sm capitalize flex-1 ${
                      isChecked ? "line-through text-stone-300" : "text-[color:var(--ink)]"
                    }`}
                  >
                    {item.name}
                  </span>
                  <button
                    onClick={() => removeExtra(item.id)}
                    className="text-stone-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={addExtra} className="flex gap-2">
          <input
            value={newExtra}
            onChange={(e) => setNewExtra(e.target.value)}
            placeholder="paper towels, birthday candles…"
            className="flex-1 bg-transparent border-b-2 border-[color:var(--line)] text-sm py-1.5 focus:outline-none focus:border-[#FF206E]"
          />
          <button
            type="submit"
            className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: accent, color: "#fff", border: `2px solid var(--ink)` }}
          >
            <Plus size={13} />
          </button>
        </form>
      </div>
    </div>
  );
}

function Splash({ onEnter, themeVars }) {
  const decorations = [
    { tag: "breakfast", rotate: "-10deg", pos: "top-8 left-6 lg:left-24" },
    { tag: "dinner", rotate: "8deg", pos: "top-14 right-6 lg:right-24" },
    { tag: "quick", rotate: "-6deg", pos: "bottom-14 left-10 lg:left-32" },
    { tag: "snack", rotate: "7deg", pos: "bottom-10 right-10 lg:right-32" },
  ];
  const mobileStamps = [
    { tag: "breakfast", rotate: "-9deg" },
    { tag: "lunch", rotate: "5deg" },
    { tag: "dinner", rotate: "-5deg" },
    { tag: "snack", rotate: "8deg" },
  ];
  const features = ["Plan your week", "Auto grocery list", "Synced everywhere"];
  return (
    <div
      className="w-full min-h-[100dvh] flex items-center justify-center px-6 py-10 relative overflow-hidden"
      style={{ backgroundColor: "var(--page-bg)", ...themeVars }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap');
        @keyframes floatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes riseIn { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>

      {decorations.map((d, i) => (
        <div
          key={d.tag}
          className={`absolute ${d.pos} hidden md:block`}
          style={{ animation: `floatY ${3.2 + i * 0.4}s ease-in-out infinite` }}
        >
          <Stamp tag={d.tag} rotate={d.rotate} />
        </div>
      ))}

      <div
        className="text-center w-full max-w-sm relative z-10"
        style={{ animation: "riseIn 0.5s ease-out both" }}
      >
        <div className="flex justify-center -space-x-2 mb-8 md:hidden">
          {mobileStamps.map((d) => (
            <Stamp key={d.tag} tag={d.tag} rotate={d.rotate} size="sm" />
          ))}
        </div>

        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "#FFD23F", border: "3px solid var(--ink)", transform: "rotate(-6deg)", ...pop(5) }}
        >
          <ChefHat size={44} color={INK} />
        </div>
        <h1
          className="text-[56px] sm:text-6xl font-extrabold leading-[0.95]"
          style={{ ...display, color: "var(--ink)" }}
        >
          Meal Index
        </h1>
        <p className="text-xs uppercase tracking-[0.25em] font-bold text-[color:var(--muted)] mt-4">
          your personal kitchen system
        </p>

        <div className="flex flex-wrap justify-center gap-2 mt-7">
          {features.map((f) => (
            <span
              key={f}
              className="text-[11px] font-bold px-3 py-1 rounded-full"
              style={{ backgroundColor: "var(--card-bg)", color: "var(--ink)", border: "1.5px solid var(--ink)" }}
            >
              {f}
            </span>
          ))}
        </div>

        <button
          onClick={onEnter}
          className="mt-9 w-full flex items-center justify-center gap-3 text-base uppercase tracking-widest font-bold text-white py-4 rounded-full transition-transform hover:scale-[1.03] active:translate-y-px"
          style={{ backgroundColor: "#FF5A5F", border: "3px solid var(--ink)", ...pop(5), ...display }}
        >
          <span
            className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0"
            style={{ border: "2px solid #171717" }}
          >
            <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4.1 6.8-10.1 6.8-17.2z" />
              <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
            </svg>
          </span>
          Continue with Google
        </button>
        <p className="text-xs text-[color:var(--muted)] mt-4 leading-snug">
          Signing in keeps your meals synced across every device.
        </p>
      </div>
    </div>
  );
}

export default function MealSelector() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(false);

  const [meals, setMeals] = useState([]);
  const [plan, setPlan] = useState({});
  const [checked, setChecked] = useState({});
  const [cookLog, setCookLog] = useState([]);
  const [essentials, setEssentials] = useState([]);
  const [extras, setExtras] = useState([]);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState("home");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [favOnly, setFavOnly] = useState(false);

  const [surpriseTag, setSurpriseTag] = useState("any");
  const [picked, setPicked] = useState(null);
  const [spinning, setSpinning] = useState(false);

  const [pantryText, setPantryText] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  // --- Auth: check for an existing session, then keep it in sync ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        // Signed out — clear local state so the next sign-in starts clean.
        setMeals([]);
        setPlan({});
        setChecked({});
        setCookLog([]);
        setEssentials([]);
        setExtras([]);
        setPrefs(DEFAULT_PREFS);
        setCloudLoaded(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = () => {
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };
  const signOut = () => {
    supabase.auth.signOut();
    setShowSettings(false);
  };

  // --- Load this person's data from the cloud once they're signed in ---
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("app_data")
        .select("data")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Failed to load cloud data:", error);
      } else if (data?.data) {
        const d = data.data;
        setMeals(d.meals || []);
        setPlan(d.plan || {});
        setChecked(d.checked || {});
        setCookLog(d.cookLog || []);
        setEssentials(d.essentials || []);
        setExtras(d.extras || []);
        setPrefs({ ...DEFAULT_PREFS, ...(d.prefs || {}) });
      }
      setCloudLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // --- Save to the cloud whenever data changes, debounced so we're not
  // writing on every keystroke. Never fires before the initial load finishes,
  // so we can't accidentally overwrite real cloud data with blank state. ---
  useEffect(() => {
    if (!session || !cloudLoaded) return;
    const timeout = setTimeout(() => {
      supabase
        .from("app_data")
        .upsert({
          user_id: session.user.id,
          data: { meals, plan, checked, cookLog, essentials, extras, prefs },
          updated_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.error("Failed to save to cloud:", error);
        });
    }, 800);
    return () => clearTimeout(timeout);
  }, [meals, plan, checked, cookLog, essentials, extras, prefs, session, cloudLoaded]);

  // Resolve "auto" theme against the system preference and keep it live if the
  // system setting changes while the app is open.
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const resolvedTheme = prefs.theme === "auto" ? (systemDark ? "dark" : "light") : prefs.theme;
  const themeVars = THEME_VARS[resolvedTheme];

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      meals,
      plan,
      checked,
      cookLog,
      essentials,
      extras,
      prefs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meal-index-backup-${todayDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.meals) setMeals(data.meals);
        if (data.plan) setPlan(data.plan);
        if (data.checked) setChecked(data.checked);
        if (data.cookLog) setCookLog(data.cookLog);
        if (data.essentials) setEssentials(data.essentials);
        if (data.extras) setExtras(data.extras);
        if (data.prefs) setPrefs({ ...DEFAULT_PREFS, ...data.prefs });
      } catch (err) {
        console.error("Import failed — file may not be a valid backup:", err);
      }
    };
    reader.readAsText(file);
  };

  const resetAllData = () => {
    setMeals([]);
    setPlan({});
    setChecked({});
    setCookLog([]);
    setEssentials([]);
    setExtras([]);
    // The debounced save effect above will pick this up and push the cleared
    // state to the cloud automatically — no separate delete call needed.
    setConfirmingReset(false);
    setShowSettings(false);
    setTab("home");
  };

  const addMeal = (meal) => setMeals((prev) => [...prev, meal]);
  const updateMeal = (meal) => setMeals((prev) => prev.map((m) => (m.id === meal.id ? meal : m)));
  const toggleFav = (id) =>
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, favorite: !m.favorite } : m)));
  const deleteMeal = (id) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    setPlan((prev) => {
      const next = {};
      Object.entries(prev).forEach(([day, ids]) => (next[day] = ids.filter((mid) => mid !== id)));
      return next;
    });
    if (picked?.id === id) setPicked(null);
  };

  const surprisePool =
    surpriseTag === "any" ? meals : meals.filter((m) => m.tags.includes(surpriseTag));

  const shuffle = () => {
    if (surprisePool.length === 0) return;
    setSpinning(true);
    let count = 0;
    const interval = setInterval(() => {
      setPicked(surprisePool[Math.floor(Math.random() * surprisePool.length)]);
      count++;
      if (count > 8) {
        clearInterval(interval);
        setSpinning(false);
      }
    }, 80);
  };

  const pantryItems = pantryText.split(",").map(normalize).filter(Boolean);
  const pantryMatches = meals
    .map((m) => {
      const mealIngs = m.ingredients.map(normalize);
      const have = mealIngs.filter((i) => pantryItems.some((p) => i.includes(p) || p.includes(i)));
      const missing = mealIngs.filter((i) => !have.includes(i));
      const score = mealIngs.length ? have.length / mealIngs.length : 0;
      return { meal: m, missing, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const TABS = ["home", "index", "plan", "groceries", "surprise", "pantry"];

  if (!authChecked) {
    return <LoadingScreen text="Loading…" themeVars={themeVars} />;
  }

  if (!session) {
    return <Splash onEnter={signInWithGoogle} themeVars={themeVars} />;
  }

  if (!cloudLoaded) {
    return <LoadingScreen text="Loading your kitchen…" themeVars={themeVars} />;
  }

  return (
    <div
      className="w-full min-h-[100dvh] flex justify-center px-4 pt-5 pb-28 sm:p-6"
      style={{ backgroundColor: "var(--page-bg)", ...themeVars }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap');
        @keyframes bounceIn { 0% { transform: scale(0.9) rotate(-2deg); } 50% { transform: scale(1.04) rotate(1deg); } 100% { transform: scale(1) rotate(0); } }
      `}</style>
      <div className="w-full max-w-2xl sm:max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 sm:mb-6">
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#FFD23F", border: `2.5px solid var(--ink)`, transform: "rotate(-6deg)", ...pop(3) }}
          >
            <ChefHat size={24} color={INK} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[28px] sm:text-4xl font-extrabold leading-none" style={{ ...display, color: "var(--ink)" }}>
              Meal Index
            </h1>
            <p className="hidden sm:block text-xs uppercase tracking-[0.2em] font-bold text-[color:var(--muted)] mt-1">
              your personal kitchen system
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-[color:var(--ink)] transition-colors"
            style={{ border: `2px solid var(--ink)`, backgroundColor: "var(--card-bg)" }}
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>

        {showSettings && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(23,23,23,0.5)" }}
          >
            <div
              className="rounded-2xl p-6 max-w-sm w-full max-h-[85vh] overflow-y-auto"
              style={{ border: `3px solid var(--ink)`, backgroundColor: "var(--card-bg)", ...pop(5) }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-extrabold" style={{ ...display, color: "var(--ink)" }}>
                  Settings
                </h3>
                <button
                  onClick={() => {
                    setShowSettings(false);
                    setConfirmingReset(false);
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ border: `2px solid var(--ink)`, color: "var(--ink)" }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Preferences */}
              <div className="mb-6">
                <p className="text-[11px] uppercase tracking-widest font-bold text-[color:var(--muted)] mb-2">
                  Preferences
                </p>

                <div className="mb-4">
                  <p className="text-xs font-bold mb-1.5" style={{ color: "var(--ink)" }}>
                    Week starts on
                  </p>
                  <div className="flex gap-2">
                    {[
                      { id: "mon", label: "Monday" },
                      { id: "sun", label: "Sunday" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPrefs((p) => ({ ...p, weekStart: opt.id }))}
                        className="flex-1 text-xs font-bold py-2 rounded-full"
                        style={
                          prefs.weekStart === opt.id
                            ? { backgroundColor: SECTION.home.color, color: "#fff", border: `2px solid var(--ink)` }
                            : { backgroundColor: "transparent", color: "var(--ink)", border: `2px solid var(--line)` }
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-bold mb-1.5" style={{ color: "var(--ink)" }}>
                    Appearance
                  </p>
                  <div className="flex gap-2">
                    {[
                      { id: "auto", label: "Auto" },
                      { id: "light", label: "Light" },
                      { id: "dark", label: "Dark" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPrefs((p) => ({ ...p, theme: opt.id }))}
                        className="flex-1 text-xs font-bold py-2 rounded-full"
                        style={
                          prefs.theme === opt.id
                            ? { backgroundColor: SECTION.home.color, color: "#fff", border: `2px solid var(--ink)` }
                            : { backgroundColor: "transparent", color: "var(--ink)", border: `2px solid var(--line)` }
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold mb-1.5" style={{ color: "var(--ink)" }}>
                    Units (protein)
                  </p>
                  <div className="flex gap-2">
                    {[
                      { id: "metric", label: "Grams (g)" },
                      { id: "imperial", label: "Ounces (oz)" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPrefs((p) => ({ ...p, units: opt.id }))}
                        className="flex-1 text-xs font-bold py-2 rounded-full"
                        style={
                          prefs.units === opt.id
                            ? { backgroundColor: SECTION.home.color, color: "#fff", border: `2px solid var(--ink)` }
                            : { backgroundColor: "transparent", color: "var(--ink)", border: `2px solid var(--line)` }
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Backup */}
              <div className="mb-6 pt-5" style={{ borderTop: "2px dashed var(--line)" }}>
                <p className="text-[11px] uppercase tracking-widest font-bold text-[color:var(--muted)] mb-2">
                  Backup
                </p>
                <p className="text-xs text-[color:var(--muted)] mb-3">
                  Your data lives only in this browser. Export a copy to keep it safe or move it
                  to another device.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={exportData}
                    className="flex-1 text-xs uppercase tracking-widest font-bold py-2 rounded-full"
                    style={{ backgroundColor: "#06A77D", color: "#fff", border: `2px solid var(--ink)` }}
                  >
                    Export data
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 text-xs uppercase tracking-widest font-bold py-2 rounded-full"
                    style={{ backgroundColor: "transparent", color: "var(--ink)", border: `2px solid var(--ink)` }}
                  >
                    Import data
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) importData(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>

              {/* Account */}
              <div className="mb-6 pt-5" style={{ borderTop: "2px dashed var(--line)" }}>
                <p className="text-[11px] uppercase tracking-widest font-bold text-[color:var(--muted)] mb-2">
                  Account
                </p>
                <p className="text-xs text-[color:var(--muted)] mb-3 truncate">
                  Signed in as {session?.user?.email}
                </p>
                <button
                  onClick={signOut}
                  className="w-full text-xs uppercase tracking-widest font-bold py-2 rounded-full"
                  style={{ backgroundColor: "transparent", color: "var(--ink)", border: `2px solid var(--ink)` }}
                >
                  Sign out
                </button>
              </div>

              {/* Danger zone */}
              <div className="pt-5" style={{ borderTop: "2px dashed var(--line)" }}>
                <p className="text-[11px] uppercase tracking-widest font-bold text-[color:var(--muted)] mb-2">
                  Danger zone
                </p>
                {!confirmingReset ? (
                  <button
                    onClick={() => setConfirmingReset(true)}
                    className="w-full text-xs uppercase tracking-widest font-bold py-2 rounded-full"
                    style={{ backgroundColor: "transparent", color: "#FF5A5F", border: `2px solid #FF5A5F` }}
                  >
                    Reset all data
                  </button>
                ) : (
                  <div>
                    <p className="text-xs text-[color:var(--muted)] mb-3">
                      This clears every meal, plan, grocery item, and log on this device. This
                      can't be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmingReset(false)}
                        className="flex-1 text-xs uppercase tracking-widest font-bold py-2 rounded-full"
                        style={{ backgroundColor: "transparent", color: "var(--ink)", border: `2px solid var(--ink)` }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={resetAllData}
                        className="flex-1 text-xs uppercase tracking-widest font-bold py-2 rounded-full text-white"
                        style={{ backgroundColor: "#FF5A5F", border: `2px solid var(--ink)` }}
                      >
                        Yes, reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section nav: pills on larger screens */}
        <div className="hidden sm:flex flex-wrap gap-2 mb-7">
          {TABS.map((id) => {
            const sec = SECTION[id];
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="text-sm uppercase tracking-wide font-bold px-4 py-2 rounded-full whitespace-nowrap transition-all"
                style={
                  active
                    ? { backgroundColor: sec.color, color: sec.ink, border: `2.5px solid var(--ink)`, ...pop(3), ...display }
                    : { backgroundColor: "var(--card-bg)", color: "var(--muted)", border: `2px solid var(--line)`, ...display }
                }
              >
                {sec.name}
              </button>
            );
          })}
        </div>

        {/* Section nav: bottom bar on phones */}
        <nav
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-6 px-1 pt-1.5"
          style={{
            backgroundColor: "var(--card-bg)",
            borderTop: "2.5px solid var(--ink)",
            paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
          }}
          aria-label="Sections"
        >
          {TABS.map((id) => {
            const sec = SECTION[id];
            const Icon = TAB_ICONS[id];
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex flex-col items-center gap-0.5 py-1"
                aria-current={active ? "page" : undefined}
              >
                <span
                  className="w-11 h-8 rounded-full flex items-center justify-center transition-all"
                  style={
                    active
                      ? { backgroundColor: sec.color, color: sec.ink, border: "2px solid var(--ink)" }
                      : { color: "var(--muted)", border: "2px solid transparent" }
                  }
                >
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                </span>
                <span
                  className="text-[10px] font-bold leading-none"
                  style={{ ...display, color: active ? "var(--ink)" : "var(--muted)" }}
                >
                  {sec.short}
                </span>
              </button>
            );
          })}
        </nav>

        {tab !== "home" && (
          <h2
            className="flex items-center gap-2.5 text-[26px] font-extrabold leading-none mb-5"
            style={{ ...display, color: "var(--ink)" }}
          >
            <span
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: SECTION[tab].color, border: "2.5px solid var(--ink)" }}
            />
            {SECTION[tab].name}
          </h2>
        )}

        {tab === "home" && (
          <HomeScreen
            meals={meals}
            plan={plan}
            setTab={setTab}
            onToggleFav={toggleFav}
            weekStart={prefs.weekStart}
            units={prefs.units}
          />
        )}

        {tab === "index" && (
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex gap-2">
                {[
                  { id: false, label: `All ${meals.length}` },
                  { id: true, label: `Favorites ${meals.filter((m) => m.favorite).length}` },
                ].map((opt) => (
                  <button
                    key={String(opt.id)}
                    onClick={() => setFavOnly(opt.id)}
                    className="flex items-center gap-1 text-[11px] uppercase tracking-wide font-bold px-3 py-2 rounded-full"
                    style={
                      favOnly === opt.id
                        ? { backgroundColor: opt.id ? "#FF206E" : "var(--ink)", color: opt.id ? "#fff" : "var(--page-bg)", border: "2px solid var(--ink)" }
                        : { backgroundColor: "transparent", color: "var(--muted)", border: "2px solid var(--line)" }
                    }
                  >
                    {opt.id && <Heart size={11} fill={favOnly ? "#fff" : "none"} />}
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setEditingId(null);
                  setShowAdd((s) => !s);
                }}
                className="flex items-center gap-1 text-xs uppercase tracking-widest font-bold text-white px-4 py-2 rounded-full shrink-0"
                style={{ backgroundColor: SECTION.index.color, border: `2px solid var(--ink)`, ...pop(3) }}
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {showAdd && (
              <AddMealForm onAdd={addMeal} onClose={() => setShowAdd(false)} units={prefs.units} />
            )}

            {meals.length === 0 && !showAdd && (
              <div
                className="rounded-2xl p-8 text-center"
                style={{ border: "2.5px dashed var(--line)", backgroundColor: "var(--card-bg)" }}
              >
                <p className="font-bold text-lg leading-tight mb-1" style={{ ...display, color: "var(--ink)" }}>
                  Empty index
                </p>
                <p className="text-sm text-[color:var(--muted)]">
                  File your first meal idea to get started.
                </p>
              </div>
            )}

            {favOnly && meals.length > 0 && !meals.some((m) => m.favorite) && (
              <p className="text-sm text-[color:var(--muted)] text-center py-12">
                No favorites yet. Tap the heart on a meal to add it here.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3">
              {meals.map((m, i) => {
                if (favOnly && !m.favorite) return null;
                if (m.id === editingId) {
                  return (
                    <div key={m.id} className="sm:col-span-2">
                      <AddMealForm
                        initial={m}
                        onSave={updateMeal}
                        onClose={() => setEditingId(null)}
                        units={prefs.units}
                      />
                    </div>
                  );
                }
                return (
                  <MealCard
                    key={m.id}
                    meal={m}
                    onDelete={deleteMeal}
                    onEdit={(id) => {
                      setShowAdd(false);
                      setEditingId(id);
                    }}
                    onToggleFav={toggleFav}
                    rotate={i}
                    units={prefs.units}
                  />
                );
              })}
            </div>
          </div>
        )}

        {tab === "plan" && (
          <WeeklyPlanner meals={meals} plan={plan} setPlan={setPlan} weekStart={prefs.weekStart} />
        )}

        {tab === "groceries" && (
          <GroceriesScreen
            meals={meals}
            plan={plan}
            checked={checked}
            setChecked={setChecked}
            essentials={essentials}
            setEssentials={setEssentials}
            extras={extras}
            setExtras={setExtras}
          />
        )}

        {tab === "surprise" && (
          <div className="flex flex-col items-center">
            <div className="w-full flex flex-wrap gap-1.5 mb-6 justify-center">
              {["any", ...TAG_OPTIONS].map((t) => {
                const active = surpriseTag === t;
                const c = t === "any" ? { bg: INK, ink: "#fff" } : tagColor(t);
                return (
                  <button
                    key={t}
                    onClick={() => setSurpriseTag(t)}
                    className="text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: c.bg,
                      color: c.ink,
                      border: `2px solid var(--ink)`,
                      opacity: active ? 1 : 0.72,
                      transform: active ? "scale(1.06)" : "scale(1)",
                      ...(active ? pop(2) : {}),
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            <div className="w-full max-w-sm h-48 relative mb-6">
              {picked ? (
                <div
                  className="w-full h-full rounded-2xl flex flex-col items-center justify-center px-5 text-center"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    border: `3px solid var(--ink)`,
                    ...pop(5),
                    animation: spinning ? "none" : "bounceIn 0.35s ease-out",
                  }}
                >
                  <div className="absolute -top-5">
                    <Stamp tag={picked.tags[0] || "quick"} rotate="-5deg" />
                  </div>
                  <p className="text-2xl font-extrabold mt-2" style={{ ...display, color: "var(--ink)" }}>
                    {picked.name}
                  </p>
                  {picked.ingredients.length > 0 && (
                    <p className="text-xs text-[color:var(--muted)] mt-2">{picked.ingredients.join(", ")}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
                    {picked.tags.slice(1).map((t) => (
                      <TagPill key={t} tag={t} />
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="w-full h-full rounded-2xl flex items-center justify-center text-[color:var(--muted)] text-sm text-center px-4"
                  style={{ border: `3px dashed var(--line)` }}
                >
                  {surprisePool.length === 0 ? "No meals match that filter yet" : "Pull a card"}
                </div>
              )}
            </div>

            <button
              onClick={shuffle}
              disabled={surprisePool.length === 0}
              className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold px-7 py-3.5 rounded-full disabled:opacity-40"
              style={{
                backgroundColor: SECTION.surprise.color,
                color: SECTION.surprise.ink,
                border: `2.5px solid var(--ink)`,
                ...pop(4),
                ...display,
              }}
            >
              <Shuffle size={16} /> {picked ? "Pull again" : "Pull a card"}
            </button>
            <p className="text-xs text-[color:var(--muted)] mt-3">
              {surprisePool.length} meal{surprisePool.length === 1 ? "" : "s"} in this pile
            </p>
          </div>
        )}

        {tab === "pantry" && (
          <div>
            <label className="text-[11px] uppercase tracking-widest font-bold text-[color:var(--muted)] flex items-center gap-1 mb-1.5">
              <Search size={11} /> What's in the kitchen?
            </label>
            <input
              value={pantryText}
              onChange={(e) => setPantryText(e.target.value)}
              placeholder="chicken thighs, rice, broccoli, soy sauce"
              className="w-full bg-transparent border-b-[3px] border-[color:var(--line)] text-base py-2 mb-5 focus:outline-none"
              style={{ borderColor: pantryText ? SECTION.pantry.color : undefined }}
            />

            {meals.length === 0 && (
              <p className="text-sm text-[color:var(--muted)] text-center py-14">
                Add a few meals to your index first — matches come from ingredients you've filed.
              </p>
            )}
            {meals.length > 0 && pantryItems.length === 0 && (
              <p className="text-sm text-[color:var(--muted)] text-center py-14">
                List what you've got, comma separated, and I'll match it against your index.
              </p>
            )}
            {pantryItems.length > 0 && pantryMatches.length === 0 && (
              <p className="text-sm text-[color:var(--muted)] text-center py-14">
                No overlap yet. Try fewer or more general ingredient names.
              </p>
            )}

            <div className="space-y-3">
              {pantryMatches.slice(0, 6).map(({ meal, missing, score }) => (
                <div
                  key={meal.id}
                  className="rounded-2xl p-4 relative"
                  style={{ border: `2.5px solid var(--ink)`, backgroundColor: "var(--card-bg)", ...pop(3) }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold" style={{ ...display, color: "var(--ink)" }}>
                      {meal.name}
                    </p>
                    <span
                      className="text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: SECTION.pantry.color, color: "#fff", border: `1.5px solid var(--ink)` }}
                    >
                      {Math.round(score * 100)}%
                    </span>
                  </div>
                  {missing.length > 0 ? (
                    <p className="text-sm text-[color:var(--muted)] mt-1">Missing: {missing.join(", ")}</p>
                  ) : (
                    <p className="text-sm mt-1 font-bold" style={{ color: "#06A77D" }}>
                      You have everything for this one!
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
