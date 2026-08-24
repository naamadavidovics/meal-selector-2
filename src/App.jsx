import { useState, useEffect, useMemo } from "react";
import {
  Shuffle,
  Plus,
  X,
  Trash2,
  Search,
  ChefHat,
  Tags,
  Flame,
  Beef,
  CalendarDays,
  ShoppingBasket,
  Check,
  RotateCcw,
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

function PunchHole({ className = "" }) {
  return (
    <div
      className={`w-3 h-3 rounded-full bg-stone-100 border border-stone-300 ${className}`}
      style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.15)" }}
    />
  );
}

function TagChip({ children, tone = "emerald" }) {
  const tones = { emerald: "bg-emerald-800", amber: "bg-amber-700" };
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 text-stone-50 rounded-sm ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function IndexCard({ meal, onDelete, rotate }) {
  return (
    <div
      className={`relative bg-stone-50 border border-stone-300 rounded-sm p-4 pt-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${rotate}`}
    >
      <PunchHole className="absolute top-2 left-2" />
      <PunchHole className="absolute top-2 right-2" />
      <button
        onClick={() => onDelete(meal.id)}
        className="absolute bottom-2 right-2 text-stone-400 hover:text-red-700 transition-colors"
        aria-label={`Delete ${meal.name}`}
      >
        <Trash2 size={14} />
      </button>
      <h3 className="font-mono font-bold text-stone-800 text-base tracking-tight pr-4">
        {meal.name}
      </h3>
      {meal.ingredients.length > 0 && (
        <p className="font-mono text-xs text-stone-500 mt-1 leading-relaxed">
          {meal.ingredients.join(", ")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {meal.tags.map((t) => (
          <TagChip key={t}>{t}</TagChip>
        ))}
        {(meal.calories || meal.protein) && (
          <TagChip tone="amber">
            <span className="inline-flex items-center gap-1">
              {meal.calories ? (
                <>
                  <Flame size={9} />
                  {meal.calories}
                </>
              ) : null}
              {meal.protein ? (
                <>
                  <Beef size={9} className="ml-1" />
                  {meal.protein}g
                </>
              ) : null}
            </span>
          </TagChip>
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

  const toggleTag = (t) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ingredients = ingredientsText
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);
    onAdd({
      id: uid(),
      name: name.trim(),
      ingredients,
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
      className="bg-stone-50 border border-stone-300 rounded-sm p-4 mb-4 relative animate-[fadeIn_0.15s_ease-out]"
    >
      <PunchHole className="absolute top-2 left-2" />
      <PunchHole className="absolute top-2 right-2" />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-8 text-stone-400 hover:text-stone-700"
      >
        <X size={16} />
      </button>
      <div className="pt-3 space-y-3">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
            Meal name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Turkey chili"
            className="w-full mt-1 bg-transparent border-b border-stone-400 font-mono text-sm text-stone-800 py-1 focus:outline-none focus:border-emerald-800"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
            Ingredients (comma separated)
          </label>
          <input
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            placeholder="ground turkey, kidney beans, canned tomato, onion"
            className="w-full mt-1 bg-transparent border-b border-stone-400 font-mono text-sm text-stone-800 py-1 focus:outline-none focus:border-emerald-800"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              Calories (optional)
            </label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full mt-1 bg-transparent border-b border-stone-400 font-mono text-sm text-stone-800 py-1 focus:outline-none focus:border-emerald-800"
            />
          </div>
          <div className="flex-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              Protein g (optional)
            </label>
            <input
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="w-full mt-1 bg-transparent border-b border-stone-400 font-mono text-sm text-stone-800 py-1 focus:outline-none focus:border-emerald-800"
            />
          </div>
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-stone-500 flex items-center gap-1">
            <Tags size={10} /> Tags
          </label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {TAG_OPTIONS.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => toggleTag(t)}
                className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-sm border transition-colors ${
                  tags.includes(t)
                    ? "bg-emerald-800 text-stone-50 border-emerald-800"
                    : "bg-transparent text-stone-600 border-stone-300 hover:border-emerald-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="font-mono text-xs uppercase tracking-widest bg-stone-800 text-stone-50 px-4 py-2 rounded-sm hover:bg-stone-900 transition-colors"
        >
          File card
        </button>
      </div>
    </form>
  );
}

function WeeklyPlanner({ meals, plan, setPlan, checked, setChecked }) {
  const tIdx = todayIndex();

  const assignMeal = (dayIdx, mealId) => {
    if (!mealId) return;
    setPlan((prev) => {
      const next = { ...prev };
      const list = next[dayIdx] || [];
      if (!list.includes(mealId)) next[dayIdx] = [...list, mealId];
      return next;
    });
  };

  const removeMeal = (dayIdx, mealId) => {
    setPlan((prev) => ({
      ...prev,
      [dayIdx]: (prev[dayIdx] || []).filter((id) => id !== mealId),
    }));
  };

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
    Object.values(plan).forEach((ids) => {
      (ids || []).forEach((id) => {
        const meal = mealById[id];
        if (!meal) return;
        meal.ingredients.forEach((ing) => {
          const key = normalize(ing);
          if (!key) return;
          counts[key] = (counts[key] || 0) + 1;
        });
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [plan, mealById]);

  const plannedCount = Object.values(plan).reduce((acc, ids) => acc + (ids?.length || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-stone-500">
          {plannedCount} meal{plannedCount === 1 ? "" : "s"} planned this week
        </p>
        <button
          onClick={clearWeek}
          className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-stone-500 hover:text-stone-800 transition-colors"
        >
          <RotateCcw size={12} /> Start new week
        </button>
      </div>

      {meals.length === 0 ? (
        <p className="text-xs text-stone-400 text-center py-14">
          File a few meals on the "My Meals" tab first, then come plan your week.
        </p>
      ) : (
        <div className="space-y-2">
          {DAYS.map((day, idx) => {
            const assigned = plan[idx] || [];
            const isToday = idx === tIdx;
            return (
              <div
                key={day}
                className={`border rounded-sm p-2.5 transition-colors ${
                  isToday ? "border-amber-700 bg-amber-50" : "border-stone-300 bg-stone-50"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-mono text-[11px] uppercase tracking-widest w-9 shrink-0 font-bold ${
                      isToday ? "text-amber-700" : "text-stone-500"
                    }`}
                  >
                    {day}
                  </span>

                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {assigned.map((id) => {
                      const meal = mealById[id];
                      if (!meal) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 text-[11px] font-mono bg-stone-800 text-stone-50 px-2 py-1 rounded-sm"
                        >
                          {meal.name}
                          <button
                            onClick={() => removeMeal(idx, id)}
                            className="hover:text-red-300 transition-colors"
                            aria-label={`Remove ${meal.name} from ${day}`}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      );
                    })}

                    <select
                      value=""
                      onChange={(e) => assignMeal(idx, e.target.value)}
                      className="text-[11px] font-mono bg-transparent border border-dashed border-stone-400 rounded-sm px-2 py-1 text-stone-500 focus:outline-none focus:border-emerald-800 cursor-pointer"
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
              </div>
            );
          })}
        </div>
      )}

      {groceryList.length > 0 && (
        <div className="mt-6 border-t border-dashed border-stone-300 pt-4">
          <h3 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-stone-600 font-bold mb-2">
            <ShoppingBasket size={14} /> Grocery list
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            {groceryList.map((item) => {
              const isChecked = !!checked[item.name];
              return (
                <li key={item.name}>
                  <button
                    onClick={() =>
                      setChecked((prev) => ({ ...prev, [item.name]: !prev[item.name] }))
                    }
                    className="w-full flex items-center gap-2 py-1 text-left group"
                  >
                    <span
                      className={`w-4 h-4 shrink-0 border rounded-sm flex items-center justify-center transition-colors ${
                        isChecked
                          ? "bg-emerald-800 border-emerald-800"
                          : "border-stone-400 group-hover:border-emerald-800"
                      }`}
                    >
                      {isChecked && <Check size={11} className="text-stone-50" />}
                    </span>
                    <span
                      className={`text-sm font-mono capitalize transition-colors ${
                        isChecked ? "line-through text-stone-400" : "text-stone-700"
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

export default function App() {
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
      Object.entries(prev).forEach(([day, ids]) => {
        next[day] = ids.filter((mid) => mid !== id);
      });
      return next;
    });
    if (picked?.id === id) setPicked(null);
  };

  const rotations = ["-rotate-1", "rotate-1", "-rotate-[0.5deg]", "rotate-[0.5deg]", "rotate-0"];

  const surprisePool =
    surpriseTag === "any" ? meals : meals.filter((m) => m.tags.includes(surpriseTag));

  const shuffle = () => {
    if (surprisePool.length === 0) return;
    setSpinning(true);
    let count = 0;
    const interval = setInterval(() => {
      const r = surprisePool[Math.floor(Math.random() * surprisePool.length)];
      setPicked(r);
      count++;
      if (count > 8) {
        clearInterval(interval);
        setSpinning(false);
      }
    }, 80);
  };

  const pantryItems = pantryText
    .split(",")
    .map((i) => normalize(i))
    .filter(Boolean);

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

  const TABS = [
    { id: "index", label: "My Meals", icon: ChefHat },
    { id: "plan", label: "Weekly Plan", icon: CalendarDays },
    { id: "surprise", label: "Surprise Me", icon: Shuffle },
    { id: "pantry", label: "What Can I Make", icon: Search },
  ];

  return (
    <div className="w-full min-h-screen bg-stone-200 flex justify-center p-4 font-mono">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="w-full max-w-2xl">
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">
            Personal Kitchen System
          </p>
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight flex items-center gap-2">
            <ChefHat size={22} /> Meal Index
          </h1>
        </div>

        <div className="flex gap-1 flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 text-[11px] uppercase tracking-widest px-3 py-2 rounded-t-sm border border-b-0 transition-colors ${
                  tab === t.id
                    ? "bg-stone-50 border-stone-300 text-stone-800 font-bold"
                    : "bg-stone-300 border-stone-300 text-stone-600 hover:bg-stone-100"
                }`}
              >
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="bg-stone-50 border border-stone-300 rounded-b-sm rounded-tr-sm p-4 min-h-[440px]">
          {tab === "index" && (
            <div className="animate-[fadeIn_0.15s_ease-out]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-stone-500">
                  {meals.length} card{meals.length === 1 ? "" : "s"} on file
                </p>
                <button
                  onClick={() => setShowAdd((s) => !s)}
                  className="flex items-center gap-1 text-[11px] uppercase tracking-widest bg-emerald-800 text-stone-50 px-3 py-1.5 rounded-sm hover:bg-emerald-900 transition-colors"
                >
                  <Plus size={13} /> Add meal
                </button>
              </div>

              {showAdd && <AddMealForm onAdd={addMeal} onClose={() => setShowAdd(false)} />}

              {meals.length === 0 && !showAdd && (
                <div className="text-center py-14 text-stone-400 text-xs">
                  Empty box. File your first meal idea to get started.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {meals.map((m, i) => (
                  <IndexCard
                    key={m.id}
                    meal={m}
                    onDelete={deleteMeal}
                    rotate={rotations[i % rotations.length]}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === "plan" && (
            <div className="animate-[fadeIn_0.15s_ease-out]">
              <WeeklyPlanner
                meals={meals}
                plan={plan}
                setPlan={setPlan}
                checked={checked}
                setChecked={setChecked}
              />
            </div>
          )}

          {tab === "surprise" && (
            <div className="flex flex-col items-center animate-[fadeIn_0.15s_ease-out]">
              <div className="w-full flex flex-wrap gap-1.5 mb-5 justify-center">
                <button
                  onClick={() => setSurpriseTag("any")}
                  className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-sm border ${
                    surpriseTag === "any"
                      ? "bg-stone-800 text-stone-50 border-stone-800"
                      : "border-stone-300 text-stone-600"
                  }`}
                >
                  any
                </button>
                {TAG_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSurpriseTag(t)}
                    className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-sm border ${
                      surpriseTag === t
                        ? "bg-stone-800 text-stone-50 border-stone-800"
                        : "border-stone-300 text-stone-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="w-64 h-40 relative mb-5">
                {picked ? (
                  <div
                    className={`w-full h-full bg-amber-50 border-2 border-stone-800 rounded-sm flex flex-col items-center justify-center px-4 text-center transition-transform ${
                      spinning ? "scale-95 opacity-70" : "scale-100 opacity-100"
                    }`}
                    style={{ boxShadow: "3px 3px 0 rgba(28,25,23,0.15)" }}
                  >
                    <PunchHole className="absolute top-2 left-2" />
                    <PunchHole className="absolute top-2 right-2" />
                    <p className="font-bold text-lg text-stone-800">{picked.name}</p>
                    {picked.ingredients.length > 0 && (
                      <p className="text-[11px] text-stone-500 mt-1">
                        {picked.ingredients.join(", ")}
                      </p>
                    )}
                    <div className="flex gap-1 mt-2">
                      {picked.tags.map((t) => (
                        <TagChip key={t}>{t}</TagChip>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full border-2 border-dashed border-stone-300 rounded-sm flex items-center justify-center text-stone-400 text-xs text-center px-4">
                    {surprisePool.length === 0 ? "No cards match that filter yet" : "Pull a card"}
                  </div>
                )}
              </div>

              <button
                onClick={shuffle}
                disabled={surprisePool.length === 0}
                className="flex items-center gap-2 text-xs uppercase tracking-widest bg-amber-700 disabled:bg-stone-300 disabled:text-stone-500 text-stone-50 px-5 py-2.5 rounded-sm hover:bg-amber-800 transition-colors"
              >
                <Shuffle size={14} /> {picked ? "Pull again" : "Pull a card"}
              </button>
              <p className="text-[10px] text-stone-400 mt-3">
                {surprisePool.length} card{surprisePool.length === 1 ? "" : "s"} in this pile
              </p>
            </div>
          )}

          {tab === "pantry" && (
            <div className="animate-[fadeIn_0.15s_ease-out]">
              <label className="text-[10px] uppercase tracking-widest text-stone-500 flex items-center gap-1 mb-1">
                <Search size={11} /> What's in the kitchen?
              </label>
              <input
                value={pantryText}
                onChange={(e) => setPantryText(e.target.value)}
                placeholder="chicken thighs, rice, broccoli, soy sauce"
                className="w-full bg-transparent border-b border-stone-400 text-sm text-stone-800 py-1.5 mb-4 focus:outline-none focus:border-emerald-800"
              />

              {meals.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-10">
                  Add a few meals to your index first — matches come from ingredients you've filed
                  on a card.
                </p>
              )}

              {meals.length > 0 && pantryItems.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-10">
                  List what you've got, comma separated, and I'll match it against your cards.
                </p>
              )}

              {pantryItems.length > 0 && pantryMatches.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-10">
                  No overlap with any filed card yet. Try fewer or more general ingredient names.
                </p>
              )}

              <div className="space-y-3">
                {pantryMatches.slice(0, 6).map(({ meal, missing, score }) => (
                  <div key={meal.id} className="bg-amber-50 border border-stone-300 rounded-sm p-3 relative">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-stone-800">{meal.name}</p>
                      <span className="text-[10px] uppercase tracking-wide text-emerald-800 font-bold">
                        {Math.round(score * 100)}% match
                      </span>
                    </div>
                    {missing.length > 0 ? (
                      <p className="text-[11px] text-stone-500 mt-1">Missing: {missing.join(", ")}</p>
                    ) : (
                      <p className="text-[11px] text-emerald-800 mt-1">
                        You have everything for this one.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
