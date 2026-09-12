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

let authToken = null;

const setAuthToken = token => {
  authToken = token;
};

const clearAuthToken = () => {
  authToken = null;
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
      throw new ApiError(
        data?.message || `Request failed with status ${response.status}`,
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
  login: (phoneNumber, otp) =>
    apiService.post('/auth/field/login', {
      phone_number: phoneNumber,
      otp,
    }),
};

export {ApiError, authService, clearAuthToken, setAuthToken};
export default apiService;
