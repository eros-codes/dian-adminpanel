//---types.ts---//
export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "USER" | "PRIMARY" | "SECONDARY";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "USER" | "PRIMARY" | "SECONDARY";
  isActive: boolean;
}

export type ProductImage = {
  id: string;
  url: string;
  publicId?: string;
};

export interface ProductOption {
  id: number;
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
  categoryOptionId?: number | null;
}

export interface CategoryOption {
  id: number;
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
}

export type CategoryOptionInput = {
  id?: number;
  name?: string;
  additionalPrice?: number;
  isAvailable?: boolean;
  _delete?: boolean;
};

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  isAvailable: boolean;
  soldCount?: number;
  categoryId: string;
  category: {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    options?: CategoryOption[];
  };
  images: ProductImage[];
  options?: ProductOption[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  tableNumber: string;
  status: "PENDING" | "CONFIRMED" | "DELIVERED" | "PAID" | "CANCELLED";
  totalAmount: number;
  paymentMethod?: 'ONLINE' | 'COD';
  trackingCode?: string | null;
  items: OrderItem[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Return {
  id: string;
  orderId: string;
  userId?: string | null;
  status: string;
  reason: string;
  refundAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiningTable {
  id: string;
  staticId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Report and API response types
export interface SalesDataRow {
  productId: string;
  product?: { name: string };
  soldQuantity: number;
  totalRevenue: number;
}

export interface ProductImageInput {
  id?: string;
  url?: string;
}

export interface OrderItem {
  id: string;
  orderId?: string;
  productId: string;
  productName?: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  totalPrice?: number;
  product?: Product;
  options?: { id?: number; name: string; additionalPrice: number }[];
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface ProductQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isActive?: boolean;
}

export interface OrderQueryDto {
  page?: number;
  take?: number;
  userId?: string;
  status?: string;
}

// Categories
export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  type: 'CAFE' | 'RESTAURANT';
  iconId?: string | null;
  iconPath?: string | null;
  discountPercent?: number;
  options?: CategoryOption[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryDto {
  name: string;
  iconUrl?: string;
  type?: 'CAFE' | 'RESTAURANT';
  options?: CategoryOptionInput[];
}

export interface UpdateCategoryDto {
  name?: string;
  isActive?: boolean;
  discountPercent?: number;
  iconUrl?: string;
  clearIcon?: boolean;
  type?: 'CAFE' | 'RESTAURANT';
  options?: CategoryOptionInput[];
}
