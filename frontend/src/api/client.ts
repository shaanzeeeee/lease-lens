import axios, { type InternalAxiosRequestConfig } from 'axios';
import { mockDashboardData, mockPropertiesData, getMockPropertyDetail, mockChatResponse } from './mockData';

// Base API configuration
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8001') + '/api';

export const apiClient = axios.create({
  baseURL: API_URL,
});

// Request interceptor to add auth token and mock responses
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ALWAYS short-circuit for the dummy showcase version!
    // Since we are deploying frontend-only to Vercel, we throw a custom error
    // containing the mock response. Our response error interceptor will catch it
    // and resolve it as a successful response.
    config.adapter = async (config) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          let data: any = {};
          
          if (config.url?.includes('/dashboard')) {
            data = mockDashboardData;
          } else if (config.url?.includes('/documents')) {
             const match = config.url.match(/property_id=(\d+)/);
             const id = match ? parseInt(match[1], 10) : 1;
             data = { items: getMockPropertyDetail(id).documents || [] };
          } else if (config.url?.includes('/deals')) {
             const match = config.url.match(/property_id=(\d+)/);
             const id = match ? parseInt(match[1], 10) : 1;
             data = { items: getMockPropertyDetail(id).deals || [] };
          } else if (config.url?.match(/\/properties\/(\d+)\/apartments/)) {
             const match = config.url.match(/\/properties\/(\d+)\/apartments/);
             const id = match ? parseInt(match[1], 10) : 1;
             data = getMockPropertyDetail(id).apartments || [];
          } else if (config.url?.match(/\/properties\/(\d+)/)) {
             const match = config.url.match(/\/properties\/(\d+)/);
             const id = match ? parseInt(match[1], 10) : 1;
             data = getMockPropertyDetail(id);
          } else if (config.url?.includes('/properties')) {
             data = { items: mockPropertiesData };
          } else if (config.url?.includes('/chat')) {
            data = mockChatResponse;
          } else if (config.url?.includes('/auth/login') || config.url?.includes('/auth/register')) {
            data = {
              access_token: 'mock_jwt_token_12345',
              user: {
                id: 1,
                email: 'recruiter@leaselens.com',
                full_name: 'Recruiter Guest',
                role: 'admin',
                tenant_id: 1
              }
            };
          } else {
            // Default empty success
            data = { items: [] };
          }

          resolve({
            data,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {}
          });
        }, 800); // Simulate network latency
      });
    };

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth-unauthorized'));
    }
    return Promise.reject(error);
  }
);
