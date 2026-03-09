import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").unique(),
  email: text("email").unique(),
  mobile: text("mobile").unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'admin' or 'staff'
  staffId: text("staff_id"),
  businessName: text("business_name"),
  ownerName: text("owner_name"),
  profileImage: text("profile_image"), // Base64 encoded profile image
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});



// Products table for inventory
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  barcode: text("barcode").notNull().unique(),
  price: real("price").notNull(),
  cost: real("cost").default(0),
  quantity: integer("quantity").notNull().default(0),
  category: text("category").default("general"),
  image: text("image"), // Base64 encoded image or URL
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(new Date()),
});

// Variants table for product variants
export const variants = sqliteTable("variants", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  barcode: text("barcode"),
  price: real("price").notNull(),
  cost: real("cost").notNull(),
  quantity: integer("quantity").notNull().default(0),
  image: text("image"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(new Date()),
});

// Sales table for transactions
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey(),
  total: real("total").notNull(),
  paymentType: text("payment_type").notNull(), // 'cash' or 'ewallet'
  paymentAmount: real("payment_amount").notNull(),
  staffId: text("staff_id"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});

// Sale items table
export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey(),
  saleId: text("sale_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  price: real("price").notNull(),
  unit: text("unit").default("pieces"),
  productName: text("product_name"),
  isNonInventory: integer("is_non_inventory", { mode: 'boolean' }).default(false),
});

// Staff table for management
export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  staffId: text("staff_id").notNull().unique(),
  passkey: text("passkey").notNull(),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});

// Expenses table
export const expenses = sqliteTable("expenses", {
    id: text("id").primaryKey(),
    description: text("description").notNull(),
    amount: real("amount").notNull(),
    category: text("category").notNull(),
    date: integer("date", { mode: 'timestamp' }).notNull(),
});

// Purchases table
export const purchases = sqliteTable("purchases", {
    id: text("id").primaryKey(),
    productName: text("productName").notNull(),
    quantity: integer("quantity").notNull(),
    cost: real("cost").notNull(),
    supplier: text("supplier"),
    date: integer("date", { mode: 'timestamp' }).notNull(),
    description: text("description"),
    details: text("details"),
    expirationDate: integer("expiration_date", { mode: 'timestamp' }),
});

// Creditors table
export const creditors = sqliteTable("creditors", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    amount: real("amount").notNull(),
    description: text("description"),
    dueDate: integer("dueDate", { mode: 'timestamp' }),
    reminderDate: integer("reminderDate", { mode: 'timestamp' }),
    isPaid: integer("is_paid", { mode: 'boolean' }).default(false),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  mobile: true,
  password: true,
  role: true,
  staffId: true,
  businessName: true,
  ownerName: true,
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  barcode: true,
  price: true,
  quantity: true,
  category: true,
  image: true,
});

export const insertSaleSchema = createInsertSchema(sales).pick({
  total: true,
  paymentType: true,
  paymentAmount: true,
  staffId: true,
});

export const insertSaleItemSchema = createInsertSchema(saleItems);

export const insertStaffSchema = createInsertSchema(staff).pick({
  name: true,
  staffId: true,
  passkey: true,
  createdBy: true,
});

export const insertExpenseSchema = createInsertSchema(expenses);
export const insertPurchaseSchema = createInsertSchema(purchases);
export const insertCreditorSchema = createInsertSchema(creditors);
export const insertVariantSchema = createInsertSchema(variants).pick({
  productId: true,
  name: true,
  barcode: true,
  price: true,
  cost: true,
  image: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type InsertVariant = z.infer<typeof insertVariantSchema>;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItems.$inferSelect;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;
export type InsertCreditor = z.infer<typeof insertCreditorSchema>;
export type Creditor = typeof creditors.$inferSelect;


// Cart item type for sales
export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit: 'pieces' | 'dozen' | 'carton';
  subtotal: number;
  isNonInventory?: boolean;
};
