const BASE_URL =
  'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api';
const REQUEST_TIMEOUT = 15000;

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const getErrorMessage = (data, status) => {
  if (typeof data?.message === 'string') {
    return data.message;
  }
  if (Array.isArray(data?.message)) {
    return data.message.join('\n');
  }
  if (Array.isArray(data?.errors)) {
    const validationMessages = data.errors
      .map(error => error?.message)
      .filter(Boolean);
    if (validationMessages.length > 0) {
      return validationMessages.join('\n');
    }
  }
  return `Request failed with status ${status}`;
};

const AUTH_TOKEN_CACHE_KEY = '__SNIPSOR_FIELD_AUTH_TOKEN__';
let authToken = global[AUTH_TOKEN_CACHE_KEY] || null;

const setAuthToken = token => {
  const normalizedToken = typeof token === 'string'
    ? token.replace(/^Bearer\s+/i, '').trim()
    : '';
  authToken = normalizedToken || null;
  global[AUTH_TOKEN_CACHE_KEY] = authToken;
};

const clearAuthToken = () => {
  authToken = null;
  delete global[AUTH_TOKEN_CACHE_KEY];
};

const extractAccessToken = response => {
  const tokenKeys = new Set(['accessToken', 'access_token', 'token', 'idToken', 'id_token', 'jwt']);
  const pending = [{value: response, depth: 0}];
  const visited = new Set();
  while (pending.length > 0) {
    const {value, depth} = pending.shift();
    if (!value || typeof value !== 'object' || visited.has(value) || depth > 4) {
      continue;
    }
    visited.add(value);
    for (const [key, nestedValue] of Object.entries(value)) {
      if (tokenKeys.has(key) && typeof nestedValue === 'string' && nestedValue.trim()) {
        return nestedValue;
      }
      if (nestedValue && typeof nestedValue === 'object') {
        pending.push({value: nestedValue, depth: depth + 1});
      }
    }
  }
  return null;
};

const request = async (endpoint, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const isFormData = options.body instanceof FormData;

  const headers = {
    Accept: 'application/json',
    ...(!isFormData && {'Content-Type': 'application/json'}),
    ...(authToken && {Authorization: `Bearer ${authToken}`}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        clearAuthToken();
      }
      throw new ApiError(
        getErrorMessage(data, response.status),
        response.status,
        data,
      );
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 408);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Unable to connect to the server.', 0);
  } finally {
    clearTimeout(timeoutId);
  }
};

const apiService = {
  get: (endpoint, options = {}) =>
    request(endpoint, {...options, method: 'GET'}),
  post: (endpoint, body, options = {}) =>
    request(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: (endpoint, body, options = {}) =>
    request(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: (endpoint, body, options = {}) =>
    request(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: (endpoint, options = {}) =>
    request(endpoint, {...options, method: 'DELETE'}),
};

const authService = {
  sendOtp: phoneNumber =>
    apiService.post('/auth/send-otp', {
      phone_number: phoneNumber,
    }),
  login: async (phoneNumber, otp) => {
    const response = await apiService.post('/auth/field/login', {
      phone_number: phoneNumber,
      otp,
    });
    const accessToken = extractAccessToken(response);
    if (!accessToken) {
      throw new ApiError('Login succeeded but no access token was returned.', 401, response);
    }
    setAuthToken(accessToken);
    return response;
  },
};

const leadService = {
  getLeads: () => apiService.get('/field/leads'),
  getLeadDetails: leadId => apiService.get(`/field/leads/${encodeURIComponent(leadId)}`),
  getAcquisitionTimeline: leadId =>
    apiService.get(`/field/leads/${encodeURIComponent(leadId)}/acquisition/timeline`, {
      headers: {'Cache-Control': 'no-cache', Pragma: 'no-cache'},
    }),
  createLead: lead => apiService.post('/field/leads', lead),
  updateAcquisitionStatus: (leadId, status) =>
    apiService.patch(`/field/leads/${encodeURIComponent(leadId)}/acquisition/status`, status),
};

export {ApiError, authService, clearAuthToken, leadService, setAuthToken};
export default apiService;
