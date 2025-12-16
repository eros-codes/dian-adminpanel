//admin-panel/src/services/api.ts
import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from "axios";
import {
  LoginDto,
  User,
  Product,
  Order,
  Return,
  ProductQueryDto,
  OrderQueryDto,
  CreateUserDto,
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
  DiningTable,
} from "@/types";

// Generic wrapper for standardized API responses used by this service
// server responses commonly: { success: boolean; data: T }
export type ApiResponse<T = unknown> = { success?: boolean; data?: T; [key: string]: unknown };

// Helper to safely extract HTTP status from axios error shapes
function extractErrorStatus(err: unknown): number | undefined {
  try {
    const st = (err as any)?.response?.status;
    return typeof st === 'number' ? st : undefined;
  } catch {
    return undefined;
  }
}

function extractErrorMessage(err: unknown): string | undefined {
  try {
    const data = (err as any)?.response?.data;
    if (!data) return (err as any)?.message ?? undefined;
    if (typeof data === 'string') return data;
    if (typeof data === 'object') return (data as any).message ?? (data as any).error ?? undefined;
    return undefined;
  } catch {
    return undefined;
  }
}

class ApiService {
  private api: AxiosInstance;
  private autoLogoutTimer: number | null = null;

  constructor() {
    const baseURL =
      import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:4000';
    // اضافه کردن /api به baseURL اگر نداره
    const apiBaseURL = baseURL.endsWith('/api') ? baseURL : `${baseURL}/api`;
    this.api = axios.create({
      baseURL: apiBaseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Schedule auto-logout if token already exists on init
    try {
      const existing = localStorage.getItem('token');
      if (existing && existing !== 'undefined' && existing !== 'null' && existing.trim() !== '') {
        this.ensureExpiryAndSchedule();
      }
    } catch {}

    // Request interceptor to add auth token (always read latest from storage)
    this.api.interceptors.request.use(
      (config: any) => {
        const cfg = config as AxiosRequestConfig;
        const rawToken = localStorage.getItem("token");
        const latestToken =
          rawToken &&
          rawToken !== "undefined" &&
          rawToken !== "null" &&
          rawToken.trim() !== ""
            ? rawToken
            : null;

        // Normalize headers to a plain object for safe manipulation
        cfg.headers = cfg.headers ?? {};
        const headers = cfg.headers as Record<string, string>;

        if (latestToken) {
          headers.Authorization = `Bearer ${latestToken}`;
          // Proactive guard: ensure expiry exists and not elapsed
          const expKey = 'adminAccessTokenExpiry';
          const now = Date.now();
          const expRaw = localStorage.getItem(expKey);
          let exp = expRaw ? Number(expRaw) : NaN;
          if (!exp || Number.isNaN(exp)) {
            // set default expiry when first time sees token
            exp = now + 2 * 60 * 60 * 1000; // always 2 hours
            localStorage.setItem(expKey, String(exp));
            this.scheduleAutoLogout(exp - now);
          } else {
            // if expired, logout immediately
            if (exp <= now) {
              this.logout();
              if (typeof window !== 'undefined') window.location.href = '/login';
              return Promise.reject(new Error('Admin token expired'));
            }
            // ensure a timer is active
            this.scheduleAutoLogout(exp - now);
          }
        } else if (headers && 'Authorization' in headers) {
          delete headers.Authorization;
        }

        if (cfg.data instanceof FormData) {
          delete headers['Content-Type'];
          delete headers['Content-type'];
        }
        
        return cfg as any;
      },
      (error) => {
        // request error logging removed
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        const status = extractErrorStatus(error);
        if (status === 401 || status === 403) {
          try {
            // Only redirect automatically if we detect an expired token.
            const token = localStorage.getItem('token');
            const expKey = 'adminAccessTokenExpiry';
            const expRaw = localStorage.getItem(expKey);
            const exp = expRaw ? Number(expRaw) : NaN;
            const now = Date.now();

            const hasToken = !!(token && token !== 'undefined' && token !== 'null' && token.trim() !== '');
            const isExpired = !!exp && !Number.isNaN(exp) && exp <= now;

            if (hasToken && isExpired) {
              // token expired -> logout and redirect
              this.logout();
              if (typeof window !== 'undefined') {
                const isDev = import.meta.env.MODE !== 'production';
                const go = () => { try { window.location.href = '/login'; } catch {} };
                if (isDev) {
                  setTimeout(go, 1500);
                } else {
                  go();
                }
              }
            } else {
              // No token (manual logout) or not sure about expiry -> do not auto-redirect
            }
          } catch (_) {}
        }
        return Promise.reject(error);
      }
    );
  }

  // Helper to safely extract HTTP status from axios error shapes
  // eslint-disable-next-line class-methods-use-this
  

  private scheduleAutoLogout(delayMs: number) {
    try {
      if (this.autoLogoutTimer) {
        window.clearTimeout(this.autoLogoutTimer);
      }
      const safeDelay = Math.max(0, delayMs);
      this.autoLogoutTimer = window.setTimeout(() => {
        try {
          this.logout();
          if (typeof window !== 'undefined') window.location.href = '/login';
        } catch {}
      }, safeDelay);
    } catch {}
  }

  private ensureExpiryAndSchedule() {
    const expKey = 'adminAccessTokenExpiry';
    const now = Date.now();
    const expRaw = localStorage.getItem(expKey);
    let exp = expRaw ? Number(expRaw) : NaN;
    if (!exp || Number.isNaN(exp)) {
      exp = now + 2 * 60 * 60 * 1000; // always 2 hours
      localStorage.setItem(expKey, String(exp));
    }
    this.scheduleAutoLogout(exp - now);
  }

  // Authentication
  async login(
    credentials: LoginDto
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { user: User; accessToken: string; refreshToken: string };
      }> = await this.api.post("/auth/login", credentials);
      const { user, accessToken, refreshToken } = response.data.data;
      // Immediately set default Authorization header for subsequent requests
      if (accessToken && accessToken.trim() !== '') {
        this.api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        try {
          localStorage.setItem('token', accessToken);
          localStorage.setItem('user', JSON.stringify(user));
          // also set expiry and schedule timer
          const expKey = 'adminAccessTokenExpiry';
          const now = Date.now();
          const twoHours = 2 * 60 * 60 * 1000;
          const exp = now + twoHours; // always 2 hours
          localStorage.setItem(expKey, String(exp));
          this.scheduleAutoLogout(exp - now);
        } catch {}
      }
      return { user, accessToken, refreshToken };
    } catch (e: unknown) {
      // Normalize axios error so callers can reliably inspect response.data
      const resp = (e as any)?.response?.data;
      // Try to extract a useful message from various shapes
      let message = (e as any)?.message || 'Request failed';
      try {
        if (resp) {
          const candidate = resp.message || resp.error || resp;
          if (typeof candidate === 'string') message = candidate;
          else if (candidate && typeof candidate === 'object') message = candidate.message || candidate.error || message;
        }
      } catch (parseErr) {
        // ignore
      }

      const err = new Error(message) as Error & { response?: unknown };
      if (typeof e === 'object' && e && 'response' in e) err.response = (e as { response?: unknown }).response;
      throw err;
    }
  }

  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    await this.api.post("/auth/change-password", { oldPassword, newPassword });
  }

  logout(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  // Users (Admin only)
  async createUser(userData: CreateUserDto): Promise<User> {
    const response = await this.api.post("/users", userData);
    const d = response.data as ApiResponse<User> | User;
    if (d && (d as ApiResponse<User>).success && (d as ApiResponse<User>).data) return (d as ApiResponse<User>).data as User;
    return response.data as User;
  }

  async getUsers(): Promise<User[]> {
    const response = await this.api.get("/users");

    // Handle API response format {success: true, data: [...]}
    if (
      response.data &&
      response.data.success &&
      Array.isArray(response.data.data)
    ) {
      return response.data.data;
    }

    return Array.isArray(response.data) ? response.data : [];
  }

  async getUserById(id: string): Promise<User> {
    const response = await this.api.get(`/users/${id}`);
    return response.data;
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const response = await this.api.patch(`/users/${id}`, userData);
    return response.data;
  }

  async deleteUser(id: string): Promise<void> {
    await this.api.delete(`/users/${id}`);
  }

  // Products
  async getProducts(
    params?: ProductQueryDto
  ): Promise<{ data: Product[]; total: number }> {
    const response = await this.api.get("/products", { params });

    // Handle API response format {success: true, data: [...]}
    if (
      response.data &&
      response.data.success &&
      Array.isArray(response.data.data)
    ) {
      return {
        data: response.data.data,
        total: response.data.data.length,
      };
    }
    return response.data;
  }

  async getProductById(id: string): Promise<Product> {
    const response = await this.api.get(`/products/${id}`);
    return response.data;
  }

  // inside ApiService class
  async createProduct(data: FormData): Promise<Product> {
    const response = await this.api.post('/products', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const d = response.data as ApiResponse<Product> | Product;
    if (d && (d as ApiResponse<Product>).success && (d as ApiResponse<Product>).data) {
      return (d as ApiResponse<Product>).data as Product;
    }
    return response.data as Product;
  }

  /**
   * Create product with JSON payload (no files).
   * Use this when creating product from admin UI.
   */
  async createProductJson(data: Record<string, unknown>): Promise<Product> {
    const response = await this.api.post('/products/json', data);
  
    // API ممکنه دو فرمت برگشت بده: { success: true, data: {...} } یا مستقیم محصول
    const d = response.data as ApiResponse<Product> | Product;
    if (d && (d as ApiResponse<Product>).success && (d as ApiResponse<Product>).data) {
      return (d as ApiResponse<Product>).data as Product;
    }

    return response.data as Product;
  }

  /**
   * Upload images for an existing product (FormData with files).
   * Endpoint: POST /products/:id/images
   * We let axios set the Content-Type boundary automatically.
   */
// api.ts (داخل کلاس ApiService)
    async uploadProductImages(
      productId: string,
      filesFormData: FormData
    ): Promise<{ success: boolean; images: { id: string; url: string; publicId?: string }[] }> {
      const response = await this.api.post(`/products/${productId}/images`, filesFormData);
      const d = response.data;

      // حالت: { success: true, images: [...] }
      if (d && d.success && Array.isArray(d.images)) {
        return { success: true, images: d.images };
      }

      // fallback
      return { success: false, images: [] };
    }

  /**
   * Update product (JSON). Server expects JSON for /products/:id patch.
   */
  async updateProduct(
    id: string,
    data: Record<string, unknown>
  ): Promise<Product> {
    const response = await this.api.patch(
      `/products/${id}`,    // ✅ backtick
      data
    );
    return response.data;
  }

  // Update category (PATCH) - used to update discountPercent
  async patchCategory(id: string, data: Record<string, unknown>): Promise<Category> {
    const response = await this.api.patch(`/categories/${id}`, data);
    const d = response.data as ApiResponse<Category> | Category;
    if ((d as ApiResponse<Category>)?.success && (d as ApiResponse<Category>)?.data) return (d as ApiResponse<Category>).data as Category;
    return response.data as Category;
  }

  async updateProductQuantity(id: string, quantity: number): Promise<Product> {
    const response = await this.api.patch(`/products/${id}/quantity`, {
      quantity,
    });
    return response.data;
  }

  async deleteProduct(id: string): Promise<void> {
    await this.api.delete(`/products/${id}`);
  }

  async deleteProductImage(imageId: string): Promise<void> {
    await this.api.delete(`/products/images/${imageId}`);
  }

  // --- Banners ---
  async getBanners(): Promise<Record<string, unknown>[]> {
    const response = await this.api.get('/banners/all');
    const d = response.data as ApiResponse<Record<string, unknown>[]> | Record<string, unknown>[];
    if ((d as ApiResponse<Record<string, unknown>[]>).success && Array.isArray((d as ApiResponse<Record<string, unknown>[]>).data)) {
      return (d as ApiResponse<Record<string, unknown>[]>).data as Record<string, unknown>[];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  async createBanner(form: FormData): Promise<Record<string, unknown> | undefined> {
    const response = await this.api.post('/banners', form);
    const d = response.data as ApiResponse<Record<string, unknown>> | Record<string, unknown>;
    if ((d as ApiResponse<Record<string, unknown>>).success && (d as ApiResponse<Record<string, unknown>>).data) {
      return (d as ApiResponse<Record<string, unknown>>).data as Record<string, unknown>;
    }
    return response.data as Record<string, unknown> | undefined;
  }

  async updateBanner(id: string, form: FormData): Promise<Record<string, unknown> | undefined> {
    const response = await this.api.patch(`/banners/${id}`, form);
    const d = response.data as ApiResponse<Record<string, unknown>> | Record<string, unknown>;
    if ((d as ApiResponse<Record<string, unknown>>).success && (d as ApiResponse<Record<string, unknown>>).data) {
      return (d as ApiResponse<Record<string, unknown>>).data as Record<string, unknown>;
    }
    return response.data as Record<string, unknown> | undefined;
  }

  /**
   * Swap banner orders atomically (admin)
   */
  async swapBannerOrder(idA: string, idB: string): Promise<void> {
    await this.api.post('/banners/swap', { idA, idB });
  }

  async reorderBanners(ids: string[]): Promise<void> {
    await this.api.post('/banners/reorder', { ids });
  }

  async deleteBanner(id: string): Promise<void> {
    await this.api.delete(`/banners/${id}`);
  }

  // Orders
  async getOrders(
    params?: OrderQueryDto
  ): Promise<{ data: Order[]; total: number }> {
    const response = await this.api.get("/orders", { params });

    // Handle API response format {success: true, data: [...]}
    if (
      response.data &&
      response.data.success &&
      Array.isArray(response.data.data)
    ) {
      return {
        data: response.data.data,
        total: response.data.data.length,
      };
    }

    return response.data;
  }

  async getOrderById(id: string): Promise<Order> {
    const response = await this.api.get(`/orders/${id}`);
    const d = response.data as ApiResponse<Order> | Order;
    // Normalize response shapes: { success: true, data: {...} } or direct order object
    if ((d as ApiResponse<Order>)?.success && (d as ApiResponse<Order>)?.data) return (d as ApiResponse<Order>).data as Order;
    return response.data as Order;
  }

  async createOrder(orderData: Partial<Order>): Promise<Order> {
    const response = await this.api.post("/orders", orderData);
    return response.data;
  }

  async updateOrderStatus(id: string, status: Order["status"]): Promise<Order> {
    const response = await this.api.patch(`/orders/${id}/status`, { status });
    return response.data;
  }

  // Sales report endpoints
  // Admin Dashboard
  async getDashboardStats(): Promise<{
    success: boolean;
    data: {
      message: string;
      data: {
        totalUsers: number;
        totalOrders: number;
        totalProducts: number;
        lowStockItems: number;
        pendingReturns: number;
      };
    };
  }> {
    const response = await this.api.get('/admin/dashboard');
    console.log('Raw API Response:', response);
    console.log('Parsed Dashboard Data:', response.data);
    return response.data;
  }

  async getSalesSummary(from?: string, to?: string): Promise<Record<string, unknown>[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await this.api.get('/admin/sales-summary', { params });
    const d = response.data as ApiResponse<Record<string, unknown>[]> | Record<string, unknown>[];
    if ((d as ApiResponse<Record<string, unknown>[]>).success && Array.isArray((d as ApiResponse<Record<string, unknown>[]>).data)) {
      return (d as ApiResponse<Record<string, unknown>[]>).data as Record<string, unknown>[];
    }
    return Array.isArray(response.data) ? response.data : [];
  }

  async resetSales(): Promise<{ success: boolean; resetAt?: string; data?: Record<string, unknown>[] }> {
    const response = await this.api.post('/admin/sales-reset');
    // New backend returns { success: true, resetAt, data: [...] }
    const d = response.data as ApiResponse<Record<string, unknown>[]> | { resetAt?: string; data?: Record<string, unknown>[] };
    if ((d as ApiResponse<Record<string, unknown>[]>).success && Array.isArray((d as ApiResponse<Record<string, unknown>[]>).data)) {
      const resetAt = (d as { resetAt?: string }).resetAt;
      return { success: true, resetAt, data: (d as ApiResponse<Record<string, unknown>[]>).data };
    }
    return response.data;
  }

  async clearResets(): Promise<{ success: boolean; deletedCount: number; data: Record<string, unknown>[] }> {
    const response = await this.api.post('/admin/sales-reset/clear');
    const d = response.data as ApiResponse<Record<string, unknown>[]> | { deletedCount?: number; data?: Record<string, unknown>[] };
    if ((d as ApiResponse<Record<string, unknown>[]>).success) {
      const deletedCount = (d as { deletedCount?: number }).deletedCount || 0;
      return { success: true, deletedCount, data: (d as ApiResponse<Record<string, unknown>[]>).data || [] };
    }
    return response.data;
  }

  // Monthly metrics for admin dashboard
  async getMonthlyMetrics(): Promise<{
    period: { current: { from: string; to: string }; previous: { from: string; to: string } };
    orders: { current: number; previous: number };
    revenue: { current: number; previous: number };
    returns: { current: number; previous: number };
  } | null> {
    const response = await this.api.get('/admin/metrics-monthly');
    const d = response.data;
    if (d && d.success && d.data) return d.data;
    if (d && d.period && d.orders && d.revenue && d.returns) return d; // fallback
    return null;
  }

  // Returns
  async getReturns(): Promise<Return[]> {
    const response = await this.api.get("/returns");

    // Handle different response formats
    if (
      response.data &&
      response.data.success &&
      Array.isArray(response.data.data)
    ) {
      return response.data.data;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  }

  /**
   * Admin: get all returns. Hits protected admin endpoint /returns/admin/all
   */
  async getReturnsAdmin(params?: Record<string, unknown>): Promise<Return[]> {
    const response = await this.api.get('/returns/admin/all', { params });
    const d = response.data as ApiResponse<Return[]> | Return[];
    if ((d as ApiResponse<Return[]>)?.success && Array.isArray((d as ApiResponse<Return[]>)?.data)) {
      return (d as ApiResponse<Return[]>).data as Return[];
    }

    if (Array.isArray(response.data)) return response.data as Return[];

    return [];
  }

  async getReturnById(id: string): Promise<Return> {
    const response = await this.api.get(`/returns/${id}`);
    return response.data;
  }

  async createReturn(returnData: Partial<Return>): Promise<Return> {
    const response = await this.api.post("/returns", returnData);
    return response.data;
  }

  async updateReturnStatus(
    id: string,
    status: Return["status"]
  ): Promise<Return> {
    const response = await this.api.patch(`/returns/${id}/status`, { status });
    return response.data;
  }

  // --- Footer Settings (admin) ---
  async getFooterSettings(): Promise<Array<{ id: number; key: string; title: string; url?: string | null }>> {
    const response = await this.api.get('/footer-settings');
    const d = response.data;
    // Support various shapes:
    // 1) { success:true, data:[...] }
    // 2) { success:true, data:{ success:true, data:[...] } }
    // 3) [...]
    const nested = d?.data?.data;
    if (Array.isArray(nested)) return nested;
    const topData = d?.data;
    if (Array.isArray(topData)) return topData;
    if (Array.isArray(d)) return d;
    return [];
  }

  async createFooterSetting(payload: { key: string; title: string; url?: string | null }) {
    const response = await this.api.post('/footer-settings', payload);
    return response.data?.data ?? response.data;
  }

  async updateFooterSetting(id: number, payload: { title?: string; url?: string | null }) {
    const response = await this.api.patch(`/footer-settings/${id}`, payload);
    return response.data?.data ?? response.data;
  }

  async deleteFooterSetting(id: number) {
    const response = await this.api.delete(`/footer-settings/${id}`);
    return response.data;
  }

  // Dining Tables (admin)
  async getDiningTables(): Promise<DiningTable[]> {
    const response = await this.api.get('/dining-tables');
    const data = response.data;
    if (Array.isArray(data)) return data as DiningTable[];
    if (Array.isArray(data?.data)) return data.data as DiningTable[];
    if (Array.isArray(data?.data?.data)) return data.data.data as DiningTable[];
    return [];
  }

  async createDiningTable(payload: Partial<DiningTable>): Promise<DiningTable> {
    const response = await this.api.post('/dining-tables', payload);
    return (response.data?.data ?? response.data) as DiningTable;
  }

  async updateDiningTable(id: string, payload: Partial<DiningTable>): Promise<DiningTable> {
    const response = await this.api.patch(`/dining-tables/${id}`, payload);
    return (response.data?.data ?? response.data) as DiningTable;
  }

  async deleteDiningTable(id: string): Promise<{ success: boolean }> {
    const response = await this.api.delete(`/dining-tables/${id}`);
    const data = response.data?.data ?? response.data;
    if (typeof data === 'object' && data && 'success' in data) return data as { success: boolean };
    return { success: true };
  }

  // Categories
  async createCategory(payload: CreateCategoryDto): Promise<Category> {
    const response: AxiosResponse<Category | { success: boolean; data: Category }> = await this.api.post(
      `/categories`,
      payload
    );
    const d = response.data as ApiResponse<Category> | Category;
    if ((d as ApiResponse<Category>)?.success && (d as ApiResponse<Category>)?.data) return (d as ApiResponse<Category>).data as Category;
    return response.data as Category;
  }

  async getCategories(): Promise<Category[]> {
    const response: AxiosResponse<
      Category[] | { success: boolean; data: Category[] }
    > = await this.api.get(`/categories`);
    const d = response.data as ApiResponse<Category[]> | Category[];
    if ((d as ApiResponse<Category[]>)?.success && Array.isArray((d as ApiResponse<Category[]>)?.data)) {
      return (d as ApiResponse<Category[]>).data as Category[];
    }
    return response.data as Category[];
  }

  async getActiveCategories(): Promise<Category[]> {
    const response: AxiosResponse<
      Category[] | { success: boolean; data: Category[] }
    > = await this.api.get(`/categories/active`);
    const d = response.data as ApiResponse<Category[]> | Category[];
    if ((d as ApiResponse<Category[]>)?.success && Array.isArray((d as ApiResponse<Category[]>)?.data)) {
      return (d as ApiResponse<Category[]>).data as Category[];
    }
    return response.data as Category[];
  }

  async getCategoryById(id: string): Promise<Category> {
    const response: AxiosResponse<Category> = await this.api.get(
      `/categories/${id}`
    );
    return response.data;
  }

  async updateCategory(
    id: string,
    payload: UpdateCategoryDto
  ): Promise<Category> {
    const response: AxiosResponse<Category | { success: boolean; data: Category }> = await this.api.put(
      `/categories/${id}`,
      payload
    );
    const d = response.data as ApiResponse<Category> | Category;
    if ((d as ApiResponse<Category>)?.success && (d as ApiResponse<Category>)?.data) return (d as ApiResponse<Category>).data as Category;
    return response.data as Category;
  }

  async deleteCategory(id: string): Promise<Category> {
    const response: AxiosResponse<Category> = await this.api.delete(
      `/categories/${id}`
    );
    return response.data;
  }

  // Comments API
  async getAllComments(): Promise<Record<string, unknown>[]> {
    const response = await this.api.get('/comments/admin/all');
    const d = response.data as unknown;
    if (Array.isArray(d)) return d as Record<string, unknown>[];
    if (d && typeof d === 'object' && Array.isArray((d as ApiResponse<Record<string, unknown>[]>).data)) return (d as ApiResponse<Record<string, unknown>[]>).data as Record<string, unknown>[];
    if (d && typeof d === 'object' && Array.isArray((d as Record<string, unknown>).items)) return ((d as Record<string, unknown>).items as unknown) as Record<string, unknown>[];
    return [];
  }

  async replyToComment(id: string, adminReply: string): Promise<Record<string, unknown> | undefined> {
    const response = await this.api.patch(`/comments/${id}/reply`, { adminReply });
    return response.data as Record<string, unknown> | undefined;
  }

  async updateCommentReply(id: string, adminReply: string): Promise<Record<string, unknown> | undefined> {
    const response = await this.api.patch(`/comments/${id}/update-reply`, { adminReply });
    return response.data as Record<string, unknown> | undefined;
  }

  async removeCommentReply(id: string): Promise<Record<string, unknown> | undefined> {
    const response = await this.api.patch(`/comments/${id}/remove-reply`);
    return response.data as Record<string, unknown> | undefined;
  }
}

export const apiService = new ApiService();
