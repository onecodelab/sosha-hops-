export const getImageForCategory = (category: string) => {
  const c = category.toLowerCase();
  if (c.includes('drink') || c.includes('juice') || c.includes('coffee') || c.includes('smoothie')) 
    return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=300&q=80';
  if (c.includes('salad') || c.includes('fasting') || c.includes('starter')) 
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&q=80';
  if (c.includes('wrap') || c.includes('sandwich') || c.includes('burger')) 
    return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=300&q=80';
  if (c.includes('soup')) 
    return 'https://images.unsplash.com/photo-1547592166-23acbe346499?auto=format&fit=crop&w=300&q=80';
  if (c.includes('breakfast') || c.includes('egg') || c.includes('pancake')) 
    return 'https://images.unsplash.com/photo-1533089862017-54148d31d4df?auto=format&fit=crop&w=300&q=80';
  if (c.includes('pasta')) 
    return 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=300&q=80';
  if (c.includes('main')) 
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80';
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80';
};

export const MENU_SEED_DATA = [
  // Fasting -> Main Course
  { category: "Main Course", name: "Grilled Vegetable Wrap", price: 599 },
  { category: "Main Course", name: "Grilled Vegetable Wrap with Tuna", price: 969 },
  { category: "Main Course", name: "Falafel Wrap", price: 649 },
  { category: "Main Course", name: "Hummus and Avocado Sandwich", price: 719 },
  { category: "Main Course", name: "Avocado Barley, Chickpea Wrap", price: 679 },
  { category: "Main Course", name: "Nile perch wrap (spicy)", price: 999 },

  // Wraps & Sandwiches -> Main Course
  { category: "Main Course", name: "Chicken Wrap with Grilled Vegetable", price: 999 },
  { category: "Main Course", name: "Avocado, Barley, Chicken Wrap (Spicy)", price: 979 },
  { category: "Main Course", name: "Grilled Beef Fillet", price: 1299 },
  { category: "Main Course", name: "Grilled Chicken Wrap", price: 1299 },
  { category: "Main Course", name: "Chicken Wrap with Mozzarella Cheese", price: 1499 },
  { category: "Main Course", name: "Chicken Mortadella Sandwich", price: 719 },

  // Juice -> Drinks
  { category: "Drinks", name: "Banana Red Coffee", price: 369 },
  { category: "Drinks", name: "Powered Spinach", price: 369 },
  { category: "Drinks", name: "Banana Yogurt Shake", price: 369 },
  { category: "Drinks", name: "Mango Sesame Smoothie", price: 449 },
  { category: "Drinks", name: "Mango and Avocado Smoothie", price: 449 },
  { category: "Drinks", name: "Energizer", price: 479 },
  { category: "Drinks", name: "Watermelon & Dates", price: 449 },
  { category: "Drinks", name: "Avocado and Dates", price: 449 },
  { category: "Drinks", name: "Peanut Smoothie", price: 369 },
  { category: "Drinks", name: "Papaya Juice", price: 369 },
  { category: "Drinks", name: "Love your Oats", price: 369 },
  { category: "Drinks", name: "Powered Green", price: 369 },
  { category: "Drinks", name: "Green Goddess", price: 369 },

  // Soup -> Soup
  { category: "Soup", name: "Spinach soup", price: 489 },
  { category: "Soup", name: "Fish soup", price: 619 },

  // Breakfast -> Breakfast
  { category: "Breakfast", name: "Egg Sandwich", price: 579 },
  { category: "Breakfast", name: "Croissant egg sandwich", price: 699 },
  { category: "Breakfast", name: "Croissant cheese sandwich", price: 579 },
  { category: "Breakfast", name: "Cheese Sandwich", price: 579 },
  { category: "Breakfast", name: "Omelet with cheese", price: 619 },
  { category: "Breakfast", name: "Omelet", price: 579 },
  { category: "Breakfast", name: "French toast Banana Sandwich", price: 449 },
  { category: "Breakfast", name: "Jam Spread Cinnamon French Toast", price: 479 },
  { category: "Breakfast", name: "Mediterranean Toast", price: 519 },
  { category: "Breakfast", name: "Egg & Spinach Wrap", price: 619 },
  { category: "Breakfast", name: "Egg & Avocado Wrap", price: 619 },
  { category: "Breakfast", name: "Scrambled Egg with Spinach", price: 619 },
  { category: "Breakfast", name: "Overnight oats", price: 419 },
  { category: "Breakfast", name: "Foul", price: 479 },
  { category: "Breakfast", name: "Shakshuka", price: 519 },
  { category: "Breakfast", name: "Quesadilla", price: 619 },
  { category: "Breakfast", name: "Toasted Bread with Avocado, Fruit & Boiled Egg", price: 499 },
  { category: "Breakfast", name: "Granola", price: 549 },
  { category: "Breakfast", name: "Local Oats", price: 549 },
  { category: "Breakfast", name: "Oatmeal", price: 619 },
  { category: "Breakfast", name: "Pancake", price: 639 },
  { category: "Breakfast", name: "Fish surprise (Fasting)", price: 619 },
  { category: "Breakfast", name: "Flaxseed /White Flour Waffle with Fruits", price: 619 },

  // Salad Bar -> Salads
  { category: "Salads", name: "Seasonal Salad", price: 699 },
  { category: "Salads", name: "Tuna", price: 879 },
  { category: "Salads", name: "Grilled Chicken", price: 819 },
  { category: "Salads", name: "Falafel", price: 699 },
  { category: "Salads", name: "Shrimp and Avocado Salad", price: 4449 },
  { category: "Salads", name: "Grilled Salmon Salad", price: 5449 },
  { category: "Salads", name: "Smoked Salmon Salad", price: 5449 },

  // Pasta Salad -> Salads
  { category: "Salads", name: "Fusilli Pasta Salad (Fasting)", price: 649 },
  { category: "Salads", name: "Fusilli Pasta Salad with Chicken", price: 799 },

  // Habeshastyle Salad -> Salads
  { category: "Salads", name: "Injera with Flaxseed (Telba) sauce salad", price: 479 },
  { category: "Salads", name: "Injera with Sesame Salad", price: 479 },

  // All Day Juices -> Drinks
  { category: "Drinks", name: "Avocado Ginger", price: 369 },
  { category: "Drinks", name: "Avocado, Pineapple, Mint", price: 369 },
  { category: "Drinks", name: "Banana, Blueberry, Honey", price: 369 },
  { category: "Drinks", name: "Mango, Carrot", price: 369 },
  { category: "Drinks", name: "Orange, Ginger", price: 369 },
  { category: "Drinks", name: "Mango Banana Smoothie", price: 449 },
  { category: "Drinks", name: "Watermelon Guanabana", price: 449 },
  { category: "Drinks", name: "Banana and Avocado Smoothie", price: 449 },
  { category: "Drinks", name: "Avocado and Dates", price: 449 },
  { category: "Drinks", name: "Chia Seed Juice", price: 369 }

].map(item => ({
  ...item,
  is_available: true,
  image_url: getImageForCategory(item.category)
}));

export const INVENTORY_SEED_DATA = [
  { name: "Beef Fillet", quantity: 12, unit: "kg", par_level: 15, location: "Freezer A", status: "low", cost_per_unit: 850, supplier: "Meat Masters Ltd" },
  { name: "Avocados", quantity: 45, unit: "pcs", par_level: 30, location: "Pantry", status: "ok", cost_per_unit: 25, supplier: "Fresh Greens" },
  { name: "Cheddar Cheese", quantity: 0.5, unit: "kg", par_level: 5, location: "Fridge 2", status: "critical", cost_per_unit: 1200, supplier: "Dairy King" },
  { name: "Burger Buns", quantity: 120, unit: "pcs", par_level: 100, location: "Pantry", status: "ok", cost_per_unit: 15, supplier: "City Bakery" },
  { name: "Tomatoes", quantity: 8, unit: "kg", par_level: 10, location: "Fridge 1", status: "low", cost_per_unit: 60, supplier: "Fresh Greens" },
  { name: "Espresso Beans", quantity: 2, unit: "kg", par_level: 10, location: "Bar Shelf", status: "critical", cost_per_unit: 1800, supplier: "Tomoca" },
  { name: "Olive Oil", quantity: 15, unit: "L", par_level: 5, location: "Pantry", status: "ok", cost_per_unit: 800, supplier: "Global Imports" },
];