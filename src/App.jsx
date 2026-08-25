import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";

const TAG_OPTIONS = ["breakfast", "lunch", "dinner", "snack", "high-protein", "quick", "batch"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MEALS_KEY = "meal-index:meals";
const PLAN_KEY = "meal-index:weeklyPlan";
const CHECKED_KEY = "meal-index:groceryChecked";

// --- Local storage helpers (swap-in replacement for Claude's window.storage) ---
function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error("Failed to load", key, err);
    return fallback;
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Failed to save", key, err);
  }
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
  index: { name: "My Meals", color: "#FF5A5F", ink: "#FFFFFF" },
  plan: { name: "Weekly Plan", color: "#06A77D", ink: "#FFFFFF" },
  surprise: { name: "Surprise Me", color: "#FFD23F", ink: INK },
  pantry: { name: "What Can I Make", color: "#8338EC", ink: "#FFFFFF" },
};

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
function tagColor(tag) {
  return TAG_COLORS[tag] || { bg: INK, ink: "#FFFFFF" };
}

const display = { fontFamily: "'Baloo 2', system-ui, sans-serif" };

function pop(offset = 4) {
  return { boxShadow: `${offset}px ${offset}px 0 ${INK}` };
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
        border: `2.5px solid ${INK}`,
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
      style={{ backgroundColor: c.bg, color: c.ink, border: `1.5px solid ${INK}` }}
    >
      {tag}
    </span>
  );
}

function MealCard({ meal, onDelete, rotate }) {
  const primary = meal.tags[0];
  return (
    <div
      className="relative bg-white rounded-2xl p-4 pr-5"
      style={{ border: `2.5px solid ${INK}`, ...pop(4) }}
    >
      {primary && (
        <div className="absolute -top-4 -right-3">
          <Stamp tag={primary} rotate={STAMP_ROTATIONS[rotate % STAMP_ROTATIONS.length]} size="sm" />
        </div>
      )}
      <button
        onClick={() => onDelete(meal.id)}
        className="absolute bottom-3 right-3 text-stone-300 hover:text-red-500 transition-colors"
        aria-label={`Delete ${meal.name}`}
      >
        <Trash2 size={15} />
      </button>
      <h3 className="text-xl font-bold pr-10" style={{ ...display, color: INK }}>
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
                <Beef size={10} /> {meal.protein}g
              </span>
            ) : null}
          </span>
        )}
      </div>
    </div>
  );
}

function AddMealForm({ onAdd, onClose }) {
  const [name, setName] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [tags, setTags] = useState([]);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");

  const toggleTag = (t) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      id: uid(),
      name: name.trim(),
      ingredients: ingredientsText.split(",").map((i) => i.trim()).filter(Boolean),
      tags,
      calories: calories ? Number(calories) : null,
      protein: protein ? Number(protein) : null,
    });
    setName("");
    setIngredientsText("");
    setTags([]);
    setCalories("");
    setProtein("");
    onClose();
  };

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-2xl p-5 mb-5 relative"
      style={{ border: `2.5px solid ${INK}`, ...pop(5) }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-stone-500 hover:text-white hover:bg-[#171717] transition-colors"
        style={{ border: `2px solid ${INK}` }}
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
              Protein g
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
                    border: `2px solid ${INK}`,
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
          style={{ backgroundColor: "#FF5A5F", border: `2.5px solid ${INK}`, ...pop(3), ...display }}
        >
          Add to index
        </button>
      </div>
    </form>
  );
}

function WeeklyPlanner({ meals, plan, setPlan, checked, setChecked }) {
  const tIdx = todayIndex();
  const accent = SECTION.plan.color;

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
  const clearWeek = () => {
    setPlan({});
    setChecked({});
  };

  const mealById = useMemo(() => {
    const m = {};
    meals.forEach((meal) => (m[meal.id] = meal));
    return m;
  }, [meals]);

  const groceryList = useMemo(() => {
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
          {DAYS.map((day, idx) => {
            const assigned = plan[idx] || [];
            const isToday = idx === tIdx;
            return (
              <div
                key={day}
                className="flex items-center gap-3 flex-wrap p-2.5 rounded-xl"
                style={{
                  border: `2px solid ${isToday ? accent : "#e7e5e4"}`,
                  backgroundColor: isToday ? `${accent}1A` : "#fff",
                }}
              >
                <span
                  className="text-xs uppercase tracking-widest font-bold w-10 shrink-0"
                  style={{ color: isToday ? accent : "#a8a29e", ...display }}
                >
                  {day}
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
                        style={{ backgroundColor: c.bg, color: c.ink, border: `1.5px solid ${INK}` }}
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

      {groceryList.length > 0 && (
        <div
          className="mt-7 pt-5 rounded-t-xl"
          style={{ borderTop: `3px dashed ${INK}` }}
        >
          <h3
            className="flex items-center gap-1.5 text-base uppercase tracking-widest font-bold mb-3"
            style={{ color: INK, ...display }}
          >
            <ShoppingBasket size={17} /> Grocery list
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {groceryList.map((item) => {
              const isChecked = !!checked[item.name];
              return (
                <li key={item.name}>
                  <button
                    onClick={() => setChecked((prev) => ({ ...prev, [item.name]: !prev[item.name] }))}
                    className="w-full flex items-center gap-2 py-1.5 text-left group"
                  >
                    <span
                      className="w-5 h-5 shrink-0 rounded-md flex items-center justify-center transition-colors"
                      style={{
                        border: `2px solid ${INK}`,
                        backgroundColor: isChecked ? accent : "#fff",
                      }}
                    >
                      {isChecked && <Check size={13} strokeWidth={3} className="text-white" />}
                    </span>
                    <span
                      className={`text-sm capitalize transition-colors ${
                        isChecked ? "line-through text-stone-300" : "text-stone-700"
                      }`}
                    >
                      {item.name}
                      {item.count > 1 && <span className="text-stone-400"> ×{item.count}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Splash({ onEnter }) {
  const decorations = [
    { tag: "breakfast", rotate: "-10deg", pos: "top-6 left-4 sm:left-10" },
    { tag: "dinner", rotate: "8deg", pos: "top-10 right-4 sm:right-12" },
    { tag: "quick", rotate: "-6deg", pos: "bottom-16 left-6 sm:left-16" },
    { tag: "snack", rotate: "7deg", pos: "bottom-10 right-8 sm:right-20" },
  ];
  return (
    <div className="w-full min-h-[700px] bg-[#FDF0DC] flex items-center justify-center p-6 relative overflow-hidden">
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
          style={{ backgroundColor: "#FFD23F", border: `3px solid ${INK}`, transform: "rotate(-6deg)", ...pop(5) }}
        >
          <ChefHat size={44} color={INK} />
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold leading-none" style={{ ...display, color: INK }}>
          Meal Index
        </h1>
        <p className="text-sm uppercase tracking-[0.25em] font-bold text-stone-400 mt-4">
          your personal kitchen system
        </p>
        <button
          onClick={onEnter}
          className="mt-8 text-base uppercase tracking-widest font-bold text-white px-8 py-4 rounded-full transition-transform hover:scale-105"
          style={{ backgroundColor: "#FF5A5F", border: `3px solid ${INK}`, ...pop(5), ...display }}
        >
          Enter your kitchen
        </button>
      </div>
    </div>
  );
}

export default function MealSelector() {
  const [entered, setEntered] = useState(false);
  const [meals, setMeals] = useState(() => loadLocal(MEALS_KEY, []));
  const [plan, setPlan] = useState(() => loadLocal(PLAN_KEY, {}));
  const [checked, setChecked] = useState(() => loadLocal(CHECKED_KEY, {}));
  const [tab, setTab] = useState("index");
  const [showAdd, setShowAdd] = useState(false);

  const [surpriseTag, setSurpriseTag] = useState("any");
  const [picked, setPicked] = useState(null);
  const [spinning, setSpinning] = useState(false);

  const [pantryText, setPantryText] = useState("");

  useEffect(() => saveLocal(MEALS_KEY, meals), [meals]);
  useEffect(() => saveLocal(PLAN_KEY, plan), [plan]);
  useEffect(() => saveLocal(CHECKED_KEY, checked), [checked]);

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

  const TABS = ["index", "plan", "surprise", "pantry"];

  if (!entered) {
    return <Splash onEnter={() => setEntered(true)} />;
  }

  return (
    <div className="w-full min-h-[700px] bg-[#FDF0DC] flex justify-center p-4 sm:p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap');
        @keyframes bounceIn { 0% { transform: scale(0.9) rotate(-2deg); } 50% { transform: scale(1.04) rotate(1deg); } 100% { transform: scale(1) rotate(0); } }
      `}</style>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#FFD23F", border: `2.5px solid ${INK}`, transform: "rotate(-6deg)" }}
          >
            <ChefHat size={26} color={INK} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-none" style={{ ...display, color: INK }}>
              Meal Index
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] font-bold text-stone-400 mt-1">
              your personal kitchen system
            </p>
          </div>
        </div>

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
                    ? { backgroundColor: s.color, color: s.ink, border: `2.5px solid ${INK}`, ...pop(3), ...display }
                    : { backgroundColor: "#fff", color: "#a8a29e", border: `2px solid #e7e5e4`, ...display }
                }
              >
                {s.name}
              </button>
            );
          })}
        </div>

        {tab === "index" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-stone-500">
                {meals.length} meal{meals.length === 1 ? "" : "s"} on file
              </p>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="flex items-center gap-1 text-xs uppercase tracking-widest font-bold text-white px-4 py-2 rounded-full"
                style={{ backgroundColor: SECTION.index.color, border: `2px solid ${INK}`, ...pop(3) }}
              >
                <Plus size={14} /> Add meal
              </button>
            </div>

            {showAdd && <AddMealForm onAdd={addMeal} onClose={() => setShowAdd(false)} />}

            {meals.length === 0 && !showAdd && (
              <div className="text-center py-16 text-stone-400 text-sm">
                Empty index. File your first meal idea to get started.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {meals.map((m, i) => (
                <MealCard key={m.id} meal={m} onDelete={deleteMeal} rotate={i} />
              ))}
            </div>
          </div>
        )}

        {tab === "plan" && (
          <WeeklyPlanner meals={meals} plan={plan} setPlan={setPlan} checked={checked} setChecked={setChecked} />
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
                      border: `2px solid ${INK}`,
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
                  className="w-full h-full rounded-2xl bg-white flex flex-col items-center justify-center px-5 text-center"
                  style={{
                    border: `3px solid ${INK}`,
                    ...pop(5),
                    animation: spinning ? "none" : "bounceIn 0.35s ease-out",
                  }}
                >
                  <div className="absolute -top-5">
                    <Stamp tag={picked.tags[0] || "quick"} rotate="-5deg" />
                  </div>
                  <p className="text-2xl font-extrabold mt-2" style={{ ...display, color: INK }}>
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
                border: `2.5px solid ${INK}`,
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
                  className="bg-white rounded-2xl p-4 relative"
                  style={{ border: `2.5px solid ${INK}`, ...pop(3) }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold" style={{ ...display, color: INK }}>
                      {meal.name}
                    </p>
                    <span
                      className="text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: SECTION.pantry.color, color: "#fff", border: `1.5px solid ${INK}` }}
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
