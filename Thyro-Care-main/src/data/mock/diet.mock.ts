export const mockFoodsToEat = [
  { name: "Fresh fruits", icon: "🍎", note: "All fresh fruits allowed" },
  { name: "Fresh vegetables", icon: "🥦", note: "Except spinach & cruciferous in excess" },
  { name: "Beef & chicken", icon: "🍗", note: "Unsalted, fresh cuts" },
  { name: "Unsalted nuts", icon: "🥜", note: "Almonds, walnuts, cashews" },
  { name: "Rice & pasta", icon: "🍚", note: "Plain, without salt" },
  { name: "Oats", icon: "🥣", note: "Plain unsalted oatmeal" },
  { name: "Egg whites", icon: "🥚", note: "Yolks contain iodine — avoid" },
  { name: "Vegetable oil", icon: "🫙", note: "Non-iodized cooking oil" },
];

export const mockFoodsToAvoid = [
  { name: "Iodized salt", icon: "🧂", severity: "high" as const },
  { name: "Seafood & fish", icon: "🐟", severity: "high" as const },
  { name: "Dairy products", icon: "🥛", severity: "high" as const },
  { name: "Egg yolks", icon: "🍳", severity: "medium" as const },
  { name: "Soy products", icon: "🫘", severity: "medium" as const },
  { name: "Red dye #3 foods", icon: "🍒", severity: "medium" as const },
  { name: "Processed foods", icon: "🥫", severity: "low" as const },
  { name: "Restaurant meals", icon: "🍽️", severity: "low" as const },
];

export const mockMeals = [
  {
    meal: "Breakfast",
    items: ["Oatmeal with fresh berries", "Sliced apple", "Water or herbal tea"],
    cals: 320,
  },
  {
    meal: "Lunch",
    items: ["Grilled chicken breast (unsalted)", "Brown rice", "Steamed broccoli with lemon"],
    cals: 480,
  },
  {
    meal: "Dinner",
    items: ["Beef stir-fry with fresh vegetables", "Plain pasta", "Fresh fruit salad"],
    cals: 550,
  },
  {
    meal: "Snacks",
    items: ["Handful of unsalted almonds", "Fresh orange", "Apple slices"],
    cals: 180,
  },
];

export const mockDietStatus = {
  day: 4,
  totalDays: 14,
  remainingDays: 10,
  adherencePct: 71,
  title: "RAI Preparation Diet",
  subtitle: "10 days remaining before your radioactive iodine treatment",
};
