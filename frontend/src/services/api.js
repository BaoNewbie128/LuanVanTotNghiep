import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Product endpoints
export const productService = {
  getAllProducts: () => api.get('/products'),
  getProductById: (id) => api.get(`/products/${id}`),
  searchProducts: (keyword) => api.get('/products/search', { params: { keyword } }),
  filterProducts: (filters) => api.get('/products/filter', { params: filters }),
};

// Auth endpoints
export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
};

// Cart endpoints
export const cartService = {
  getCart: () => api.get('/cart'),
  addToCart: (productId, quantity) => api.post('/cart/add', { product_id: productId, quantity }),
  removeFromCart: (cartItemId) => api.delete(`/cart/remove/${cartItemId}`),
  updateCartItem: (cartItemId, quantity) => api.put(`/cart/update/${cartItemId}`, { quantity }),
};

// Wishlist endpoints
export const wishlistService = {
  getWishlist: () => api.get('/wishlist'),
  addToWishlist: (productId) => api.post('/wishlist/add', { product_id: productId }),
  removeFromWishlist: (productId) => api.delete(`/wishlist/remove/${productId}`),
};

export default api;
