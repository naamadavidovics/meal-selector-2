import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import {
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
  light: { "--page-bg": "#FDF0DC", "--card-bg": "#FFFFFF", "--ink": "#171717" },
  dark: { "--page-bg": "#1C1917", "--card-bg": "#292524", "--ink": "#F5F5F4" },
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
  home: { name: "Home", color: "#3A86FF", ink: "#FFFFFF" },
  index: { name: "My Meals", color: "#FF5A5F", ink: "#FFFFFF" },
  plan: { name: "Weekly Plan", color: "#06A77D", ink: "#FFFFFF" },
  groceries: { name: "Groceries", color: "#FF206E", ink: "#FFFFFF" },
  surprise: { name: "Surprise Me", color: "#FFD23F", ink: INK },
  pantry: { name: "What Can I Make", color: "#8338EC", ink: "#FFFFFF" },
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
  const dims = size === "sm" ? "w-14 h-14 text-[9px]" : "w-16 h-16 text-[10px]";
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

function MealCard({ meal, onDelete, rotate, stats, onLogCook, units = "metric" }) {
  const primary = meal.tags[0];
  const proteinDisplay =
    meal.protein != null ? (units === "imperial" ? `${gToOz(meal.protein)}oz` : `${meal.protein}g`) : null;
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ border: `2.5px solid var(--ink)`, backgroundColor: "var(--card-bg)", ...pop(4) }}
    >
      {primary && (
        <div className="absolute -top-4 -right-3 z-10">
          <Stamp tag={primary} rotate={STAMP_ROTATIONS[rotate % STAMP_ROTATIONS.length]} size="sm" />
        </div>
      )}
      {meal.photo && (
        <div className="w-full h-32" style={{ borderBottom: `2.5px solid var(--ink)` }}>
          <img src={meal.photo} alt={meal.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4 pr-5">
        {onDelete && (
          <button
            onClick={() => onDelete(meal.id)}
            className="absolute bottom-3 right-3 text-stone-300 hover:text-red-500 transition-colors"
            aria-label={`Delete ${meal.name}`}
          >
            <Trash2 size={15} />
          </button>
        )}
        <h3 className="text-xl font-bold pr-10" style={{ ...display, color: "var(--ink)" }}>
          {meal.name}
        </h3>
        {meal.ingredients.length > 0 && (
          <p className="text-sm text-stone-500 mt-1 leading-snug">{meal.ingredients.join(", ")}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {meal.tags.slice(1).map((t) => (
            <TagPill key={t} tag={t} />
          ))}
          {(meal.calories || meal.protein) && (
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-stone-400 ml-0.5">
              {meal.calories ? (
                <span className="inline-flex items-center gap-0.5">
                  <Flame size={10} /> {meal.calories}
                </span>
              ) : null}
              {meal.protein ? (
                <span className="inline-flex items-center gap-0.5">
                  <Beef size={10} /> {proteinDisplay}
                </span>
              ) : null}
            </span>
          )}
        </div>
        {stats && (
          <div
            className="flex items-center justify-between mt-3 pt-3"
            style={{ borderTop: "1.5px dashed #e7e5e4" }}
          >
            <p className="text-[10px] uppercase tracking-wide font-bold text-stone-400">
              {stats.timesCooked > 0
                ? `Made ${stats.timesCooked}x · last ${formatShortDate(stats.lastCooked)}`
                : "Never made yet"}
            </p>
            {onLogCook && (
              <button
                onClick={() => onLogCook(meal.id)}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#06A77D", color: "#fff", border: `1.5px solid var(--ink)` }}
              >
                <Check size={10} /> Made this
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AddMealForm({ onAdd, onClose, units = "metric" }) {
  const [name, setName] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [tags, setTags] = useState([]);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [photo, setPhoto] = useState(null);
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
    onAdd({
      id: uid(),
      name: name.trim(),
      ingredients: ingredientsText.split(",").map((i) => i.trim()).filter(Boolean),
      tags,
      calories: calories ? Number(calories) : null,
      protein: proteinGrams,
      photo,
    });
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
        className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-stone-500 hover:text-white hover:bg-[#171717] transition-colors"
        style={{ border: `2px solid var(--ink)` }}
      >
        <X size={14} />
      </button>
      <p className="text-sm uppercase tracking-widest font-bold text-[#FF5A5F] mb-3">New meal</p>
      <div className="space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">
            Meal name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Turkey chili"
            className="w-full mt-1 bg-transparent border-b-[3px] border-stone-200 text-lg py-1 focus:outline-none focus:border-[#FF5A5F]"
            style={display}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">
            Ingredients (comma separated)
          </label>
          <input
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            placeholder="ground turkey, kidney beans, canned tomato, onion"
            className="w-full mt-1 bg-transparent border-b border-stone-200 text-sm py-1 focus:outline-none focus:border-[#FF5A5F]"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">
              Calories
            </label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full mt-1 bg-transparent border-b border-stone-200 text-sm py-1 focus:outline-none focus:border-[#FF5A5F]"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">
              Protein ({units === "imperial" ? "oz" : "g"})
            </label>
            <input
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="w-full mt-1 bg-transparent border-b border-stone-200 text-sm py-1 focus:outline-none focus:border-[#FF5A5F]"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold flex items-center gap-1">
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
                style={{ border: `2px dashed #d6d3d1` }}
              >
                <ImageIcon size={18} />
              </div>
            )}
            <label
              className="text-[10px] uppercase tracking-wide font-bold px-3 py-2 rounded-full cursor-pointer"
              style={{ backgroundColor: "#fff", color: "var(--ink)", border: `2px solid var(--ink)` }}
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
          <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold flex items-center gap-1">
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
                    backgroundColor: active ? c.bg : "#fff",
                    color: active ? c.ink : "#78716c",
                    border: `2px solid var(--ink)`,
                    transform: active ? "scale(1.05)" : "scale(1)",
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
          Add to index
        </button>
      </div>
    </form>
  );
}

function HomeScreen({ meals, plan, setTab, mealStats, onLogCook, weekStart, units }) {
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

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-sm uppercase tracking-widest font-bold" style={{ color: accent }}>
          {greeting()}
        </p>
        <h2 className="text-3xl font-extrabold" style={{ ...display, color: "var(--ink)" }}>
          {todayLabel}, {dateLabel}
        </h2>
      </div>

      {/* Today's spotlight */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">
          On the menu today
        </p>
        {todayMeals.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ border: `2.5px dashed #d6d3d1`, backgroundColor: "var(--card-bg)" }}
          >
            <p className="text-stone-400 text-sm mb-3">Nothing planned for today yet.</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => setTab("surprise")}
                className="text-xs uppercase tracking-widest font-bold px-4 py-2 rounded-full"
                style={{
                  backgroundColor: SECTION.surprise.color,
                  color: SECTION.surprise.ink,
                  border: `2px solid var(--ink)`,
                  ...pop(3),
                }}
              >
                Surprise me
              </button>
              <button
                onClick={() => setTab("plan")}
                className="text-xs uppercase tracking-widest font-bold px-4 py-2 rounded-full"
                style={{ backgroundColor: "#fff", color: "var(--ink)", border: `2px solid var(--ink)`, ...pop(3) }}
              >
                Plan my week
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {todayMeals.map((meal, i) => (
              <MealCard
                key={meal.id}
                meal={meal}
                onDelete={null}
                rotate={i}
                stats={mealStats[meal.id]}
                onLogCook={onLogCook}
                units={units}
              />
            ))}
          </div>
        )}
      </div>

      {/* Week strip */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">
          This week
        </p>
        <button onClick={() => setTab("plan")} className="w-full flex gap-2 justify-between">
          {days.map(({ label, idx }) => {
            const count = (plan[idx] || []).length;
            const first = count > 0 ? mealById[plan[idx][0]] : null;
            const dotColor = first ? tagColor(first.tags[0]).bg : "#e7e5e4";
            const isToday = idx === tIdx;
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl"
                style={{
                  border: `2px solid ${isToday ? accent : "#e7e5e4"}`,
                  backgroundColor: isToday ? `${accent}14` : "var(--card-bg)",
                }}
              >
                <span
                  className="text-[10px] uppercase tracking-wide font-bold"
                  style={{ color: isToday ? accent : "#a8a29e" }}
                >
                  {label}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: dotColor, border: count > 0 ? `1.5px solid var(--ink)` : "none" }}
                />
              </div>
            );
          })}
        </button>
      </div>

      {/* Quick stats */}
      <div className="flex gap-4 flex-wrap">
        <div
          className="rounded-xl px-4 py-3 flex-1 min-w-[140px]"
          style={{ border: `2px solid var(--ink)`, backgroundColor: "var(--card-bg)", ...pop(3) }}
        >
          <p className="text-2xl font-extrabold" style={{ ...display, color: "var(--ink)" }}>
            {meals.length}
          </p>
          <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">
            meals filed
          </p>
        </div>
        <div
          className="rounded-xl px-4 py-3 flex-1 min-w-[140px]"
          style={{ border: `2px solid var(--ink)`, backgroundColor: "var(--card-bg)", ...pop(3) }}
        >
          <p className="text-2xl font-extrabold" style={{ ...display, color: "var(--ink)" }}>
            {plannedCount}
          </p>
          <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">
            planned this week
          </p>
        </div>
      </div>

      {staples.length > 0 && (
        <div className="mt-8">
          <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">
            Your staples
          </p>
          <p className="text-xs text-stone-400 mb-3">
            Ingredients that show up again and again — worth always having stocked.
          </p>
          <div className="flex flex-wrap gap-2">
            {staples.map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 text-xs font-bold capitalize px-3 py-1.5 rounded-full"
                style={{ backgroundColor: "#fff", color: "var(--ink)", border: `2px solid var(--ink)` }}
              >
                {name}
                <span
                  className="text-[10px] rounded-full px-1.5"
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

function WeeklyPlanner({ meals, plan, setPlan, weekStart }) {
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
        <p className="text-sm text-stone-500">
          {plannedCount} meal{plannedCount === 1 ? "" : "s"} planned this week
        </p>
        <button
          onClick={clearWeek}
          className="flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold text-stone-400 hover:text-[#171717] transition-colors"
        >
          <RotateCcw size={12} /> Start new week
        </button>
      </div>

      {meals.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-14">
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
                  border: `2px solid ${isToday ? accent : "#e7e5e4"}`,
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
                  <select
                    value=""
                    onChange={(e) => assignMeal(idx, e.target.value)}
                    className="text-xs font-bold bg-transparent border border-dashed border-stone-300 rounded-full px-2.5 py-1 text-stone-400 focus:outline-none cursor-pointer"
                  >
                    <option value="">+ add meal</option>
                    {meals.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        className="mt-6 rounded-xl p-3 flex items-center justify-between"
        style={{ border: `2px dashed #d6d3d1` }}
      >
        <p className="text-xs text-stone-400">
          Your grocery list now lives on its own page — auto-filled from this plan, plus your
          essentials.
        </p>
      </div>
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
      style={{ border: `2px solid var(--ink)`, backgroundColor: isChecked ? accent : "#fff" }}
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
        <p className="text-xs text-stone-400 mb-3">Auto-filled from Weekly Plan.</p>
        {planList.length === 0 ? (
          <p className="text-sm text-stone-400">Nothing planned this week yet.</p>
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
                      isChecked ? "line-through text-stone-300" : "text-stone-700"
                    }`}
                  >
                    {item.name}
                    {item.count > 1 && (
                      <span className="text-stone-400 font-normal">
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
      <div className="mb-8 pt-6" style={{ borderTop: `2px dashed #e7e5e4` }}>
        <h3
          className="flex items-center gap-1.5 text-sm uppercase tracking-widest font-bold mb-1"
          style={{ color: "var(--ink)", ...display }}
        >
          <AlertCircle size={16} /> Time to restock
        </h3>
        <p className="text-xs text-stone-400 mb-3">
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
                      isChecked ? "line-through text-stone-300" : "text-stone-700"
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
                    className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="flex-1 bg-transparent border-b-2 border-stone-200 text-sm py-1.5 focus:outline-none focus:border-[#FF206E]"
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
      <div className="pt-6" style={{ borderTop: `2px dashed #e7e5e4` }}>
        <h3
          className="flex items-center gap-1.5 text-sm uppercase tracking-widest font-bold mb-1"
          style={{ color: "var(--ink)", ...display }}
        >
          <Plus size={16} /> Add your own
        </h3>
        <p className="text-xs text-stone-400 mb-3">One-off items just for this trip.</p>

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
                      isChecked ? "line-through text-stone-300" : "text-stone-700"
                    }`}
                  >
                    {item.name}
                  </span>
                  <button
                    onClick={() => removeExtra(item.id)}
                    className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="flex-1 bg-transparent border-b-2 border-stone-200 text-sm py-1.5 focus:outline-none focus:border-[#FF206E]"
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
    { tag: "breakfast", rotate: "-10deg", pos: "top-6 left-4 sm:left-10" },
    { tag: "dinner", rotate: "8deg", pos: "top-10 right-4 sm:right-12" },
    { tag: "quick", rotate: "-6deg", pos: "bottom-16 left-6 sm:left-16" },
    { tag: "snack", rotate: "7deg", pos: "bottom-10 right-8 sm:right-20" },
  ];
  return (
    <div
      className="w-full min-h-[700px] flex items-center justify-center p-6 relative overflow-hidden"
      style={{ backgroundColor: "var(--page-bg)", ...themeVars }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap');
        @keyframes floatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>

      {decorations.map((d) => (
        <div key={d.tag} className={`absolute ${d.pos} hidden sm:block`} style={{ animation: "floatY 3.5s ease-in-out infinite" }}>
          <Stamp tag={d.tag} rotate={d.rotate} />
        </div>
      ))}

      <div className="text-center max-w-md relative z-10">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "#FFD23F", border: `3px solid var(--ink)`, transform: "rotate(-6deg)", ...pop(5) }}
        >
          <ChefHat size={44} color={INK} />
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold leading-none" style={{ ...display, color: "var(--ink)" }}>
          Meal Index
        </h1>
        <p className="text-sm uppercase tracking-[0.25em] font-bold text-stone-400 mt-4">
          your personal kitchen system
        </p>
        <button
          onClick={onEnter}
          className="mt-8 flex items-center gap-3 mx-auto text-base uppercase tracking-widest font-bold text-white px-8 py-4 rounded-full transition-transform hover:scale-105"
          style={{ backgroundColor: "#FF5A5F", border: `3px solid var(--ink)`, ...pop(5), ...display }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFF" d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.1-5.1C33.5 6.1 29 4.4 24 4.4 13.2 4.4 4.4 13.2 4.4 24S13.2 43.6 24 43.6 43.6 34.8 43.6 24c0-1.2-.1-2.4-.4-3.5z" />
          </svg>
          Sign in with Google
        </button>
        <p className="text-xs text-stone-400 mt-4">
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

  const [surpriseTag, setSurpriseTag] = useState("any");
  const [picked, setPicked] = useState(null);
  const [spinning, setSpinning] = useState(false);

  const [pantryText, setPantryText] = useState("");

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

  const logCook = (mealId) =>
    setCookLog((prev) => [...prev, { id: uid(), mealId, date: todayDateStr() }]);

  const mealStats = useMemo(() => {
    const stats = {};
    cookLog.forEach((entry) => {
      if (!stats[entry.mealId]) stats[entry.mealId] = { timesCooked: 0, lastCooked: entry.date };
      stats[entry.mealId].timesCooked += 1;
      if (entry.date > stats[entry.mealId].lastCooked) stats[entry.mealId].lastCooked = entry.date;
    });
    return stats;
  }, [cookLog]);

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
    return (
      <div
        className="w-full min-h-[700px] flex items-center justify-center"
        style={{ backgroundColor: "var(--page-bg)", ...themeVars }}
      >
        <p className="text-sm text-stone-400">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Splash onEnter={signInWithGoogle} themeVars={themeVars} />;
  }

  if (!cloudLoaded) {
    return (
      <div
        className="w-full min-h-[700px] flex items-center justify-center"
        style={{ backgroundColor: "var(--page-bg)", ...themeVars }}
      >
        <p className="text-sm text-stone-400">Loading your kitchen…</p>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-[700px] flex justify-center p-4 sm:p-6"
      style={{ backgroundColor: "var(--page-bg)", ...themeVars }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap');
        @keyframes bounceIn { 0% { transform: scale(0.9) rotate(-2deg); } 50% { transform: scale(1.04) rotate(1deg); } 100% { transform: scale(1) rotate(0); } }
      `}</style>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#FFD23F", border: `2.5px solid var(--ink)`, transform: "rotate(-6deg)" }}
          >
            <ChefHat size={26} color={INK} />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-none" style={{ ...display, color: "var(--ink)" }}>
              Meal Index
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] font-bold text-stone-400 mt-1">
              your personal kitchen system
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-stone-400 hover:text-[#171717] transition-colors"
            style={{ border: `2px solid #e7e5e4` }}
            aria-label="Settings"
          >
            <Settings size={16} />
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
                <p className="text-[11px] uppercase tracking-widest font-bold text-stone-400 mb-2">
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
                            : { backgroundColor: "transparent", color: "var(--ink)", border: `2px solid #d6d3d1` }
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
                            : { backgroundColor: "transparent", color: "var(--ink)", border: `2px solid #d6d3d1` }
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
                            : { backgroundColor: "transparent", color: "var(--ink)", border: `2px solid #d6d3d1` }
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Backup */}
              <div className="mb-6 pt-5" style={{ borderTop: "2px dashed #e7e5e4" }}>
                <p className="text-[11px] uppercase tracking-widest font-bold text-stone-400 mb-2">
                  Backup
                </p>
                <p className="text-xs text-stone-400 mb-3">
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
              <div className="mb-6 pt-5" style={{ borderTop: "2px dashed #e7e5e4" }}>
                <p className="text-[11px] uppercase tracking-widest font-bold text-stone-400 mb-2">
                  Account
                </p>
                <p className="text-xs text-stone-500 mb-3 truncate">
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
              <div className="pt-5" style={{ borderTop: "2px dashed #e7e5e4" }}>
                <p className="text-[11px] uppercase tracking-widest font-bold text-stone-400 mb-2">
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
                    <p className="text-xs text-stone-500 mb-3">
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

        {/* Section nav */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((id) => {
            const s = SECTION[id];
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="text-xs sm:text-sm uppercase tracking-wide font-bold px-4 py-2 rounded-full whitespace-nowrap transition-all"
                style={
                  active
                    ? { backgroundColor: s.color, color: s.ink, border: `2.5px solid var(--ink)`, ...pop(3), ...display }
                    : { backgroundColor: "#fff", color: "#a8a29e", border: `2px solid #e7e5e4`, ...display }
                }
              >
                {s.name}
              </button>
            );
          })}
        </div>

        {tab === "home" && (
          <HomeScreen
            meals={meals}
            plan={plan}
            setTab={setTab}
            mealStats={mealStats}
            onLogCook={logCook}
            weekStart={prefs.weekStart}
            units={prefs.units}
          />
        )}

        {tab === "index" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-stone-500">
                {meals.length} meal{meals.length === 1 ? "" : "s"} on file
              </p>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="flex items-center gap-1 text-xs uppercase tracking-widest font-bold text-white px-4 py-2 rounded-full"
                style={{ backgroundColor: SECTION.index.color, border: `2px solid var(--ink)`, ...pop(3) }}
              >
                <Plus size={14} /> Add meal
              </button>
            </div>

            {showAdd && (
              <AddMealForm onAdd={addMeal} onClose={() => setShowAdd(false)} units={prefs.units} />
            )}

            {meals.length === 0 && !showAdd && (
              <div className="text-center py-16 text-stone-400 text-sm">
                Empty index. File your first meal idea to get started.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {meals.map((m, i) => (
                <MealCard
                  key={m.id}
                  meal={m}
                  onDelete={deleteMeal}
                  rotate={i}
                  stats={mealStats[m.id]}
                  onLogCook={logCook}
                  units={prefs.units}
                />
              ))}
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
                      backgroundColor: active ? c.bg : "#fff",
                      color: active ? c.ink : "#78716c",
                      border: `2px solid var(--ink)`,
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
                    <p className="text-xs text-stone-500 mt-2">{picked.ingredients.join(", ")}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
                    {picked.tags.slice(1).map((t) => (
                      <TagPill key={t} tag={t} />
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="w-full h-full rounded-2xl flex items-center justify-center text-stone-400 text-sm text-center px-4"
                  style={{ border: `3px dashed #d6d3d1` }}
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
            <p className="text-xs text-stone-400 mt-3">
              {surprisePool.length} meal{surprisePool.length === 1 ? "" : "s"} in this pile
            </p>
          </div>
        )}

        {tab === "pantry" && (
          <div>
            <label className="text-[11px] uppercase tracking-widest font-bold text-stone-400 flex items-center gap-1 mb-1.5">
              <Search size={11} /> What's in the kitchen?
            </label>
            <input
              value={pantryText}
              onChange={(e) => setPantryText(e.target.value)}
              placeholder="chicken thighs, rice, broccoli, soy sauce"
              className="w-full bg-transparent border-b-[3px] border-stone-200 text-base py-2 mb-5 focus:outline-none"
              style={{ borderColor: pantryText ? SECTION.pantry.color : undefined }}
            />

            {meals.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-14">
                Add a few meals to your index first — matches come from ingredients you've filed.
              </p>
            )}
            {meals.length > 0 && pantryItems.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-14">
                List what you've got, comma separated, and I'll match it against your index.
              </p>
            )}
            {pantryItems.length > 0 && pantryMatches.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-14">
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
                    <p className="text-sm text-stone-500 mt-1">Missing: {missing.join(", ")}</p>
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
