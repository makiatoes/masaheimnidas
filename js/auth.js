// API Base URL - Update this to match your Laravel backend URL
// For production: https://masaheimnida.others.ccs4thyear.com
// For local development: http://localhost:8000
const API_BASE_URL = 'https://masaheimnida.others.ccs4thyear.com';

// Helper function to check if user is authenticated
function isAuthenticated() {
    return localStorage.getItem('isAuthenticated') === 'true';
}

// Helper function to get current user
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Helper function to get token
function getToken() {
    return localStorage.getItem('token');
}

// Helper function to logout
function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('isAuthenticated');
    window.location.href = 'login.html';
}

// Set axios default base URL
if (typeof axios !== 'undefined') {
    axios.defaults.baseURL = `${API_BASE_URL}/api`;
    
    // Add request interceptor to include token in headers
    axios.interceptors.request.use(function (config) {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    }, function (error) {
        return Promise.reject(error);
    });
    
    // Add response interceptor for error handling
    axios.interceptors.response.use(function (response) {
        return response;
    }, function (error) {
        // Handle 401 unauthorized - redirect to login
        if (error.response && error.response.status === 401) {
            logout();
        }
        return Promise.reject(error);
    });
}

