export const CATEGORIES = ["Computers", "Phones", "Audio", "Accessories", "Gaming", "LCD", "Flex", "Batterie"];

export const LOW_STOCK_THRESHOLD = 5;

export const initialProducts = [
  { id: 1, name: 'MacBook Air 13" M3', sku: "CMP-00041", category: "Computers", price: 1099, stock: 12, tone: "#c9ced6" },
  { id: 2, name: "iPhone 15 Pro", sku: "PHN-00082", category: "Phones", price: 999, stock: 4, tone: "#1c1c1f" },
  { id: 3, name: "Sony WH-1000XM5", sku: "AUD-00241", category: "Audio", price: 399, stock: 18, tone: "#dfe6f1" },
  { id: 4, name: "Magic Keyboard", sku: "ACC-00429", category: "Accessories", price: 99, stock: 3, tone: "#eceef1" },
  { id: 5, name: "PlayStation 5 Slim", sku: "GAM-02417", category: "Gaming", price: 499, stock: 8, tone: "#a3237f" },
  { id: 6, name: "Logitech MX Anywhere 3S", sku: "ACC-00512", category: "Accessories", price: 99, stock: 30, tone: "#d7dbe3" },
  { id: 7, name: "Razer BlackShark V2", sku: "AUD-00318", category: "Audio", price: 109, stock: 27, tone: "#1f2a1f" },
  { id: 8, name: "Dell XPS 13", sku: "CMP-00067", category: "Computers", price: 1299, stock: 0, tone: "#aab4c3" },
];

export function getStatus(stock) {
  if (stock <= 0) return "out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "in";
}

export const STATUS_LABEL = { in: "In stock", low: "Low stock", out: "Out of stock" };

export const money = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
