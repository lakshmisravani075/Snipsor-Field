import * as Keychain from 'react-native-keychain';

const SESSION_OPTIONS = {service: 'com.snipsor.field.session'};
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
  if (typeof data?.error === 'string') {
    return data.error;
  }
  if (typeof data?.error?.message === 'string') {
    return data.error.message;
  }
  if (typeof data?.error_description === 'string') {
    return data.error_description;
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
  if (typeof data?.detail === 'string') {
    return data.detail;
  }
  if (Array.isArray(data?.detail)) {
    const validationMessages = data.detail
      .map(error => error?.msg || error?.message)
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
  return Keychain.resetGenericPassword(SESSION_OPTIONS);
};

const extractAccessToken = response => {
  // Prefer the OAuth access token.  An ID token can be present in the same
  // login response but may not carry the API scopes required by activation.
  const tokenKeys = ['access_token', 'accessToken', 'token', 'jwt', 'id_token', 'idToken'];
  const pending = [{value: response, depth: 0}];
  const visited = new Set();
  while (pending.length > 0) {
    const {value, depth} = pending.shift();
    if (!value || typeof value !== 'object' || visited.has(value) || depth > 4) {
      continue;
    }
    visited.add(value);
    for (const key of tokenKeys) {
      const token = value[key];
      if (typeof token === 'string' && token.trim()) { return token; }
    }
    for (const nestedValue of Object.values(value)) {
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
      const apiError = new ApiError(
        getErrorMessage(data, response.status),
        response.status,
        data,
      );
      if (response.status === 401) {
        try {
          await clearAuthToken();
        } catch {
          // Preserve the 401 so existing session-expired handlers can log out
          // and retry removing the saved credentials.
          throw apiError;
        }
      }
      throw apiError;
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
  restoreSession: async () => {
    const credentials = await Keychain.getGenericPassword(SESSION_OPTIONS);
    if (!credentials) { return null; }
    if (!credentials.username || !credentials.password?.trim()) {
      await clearAuthToken();
      return null;
    }
    setAuthToken(credentials.password);
    return {mobileNumber: credentials.username};
  },
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
    const stored = await Keychain.setGenericPassword(String(phoneNumber), accessToken, SESSION_OPTIONS);
    if (!stored) { throw new Error('Unable to save your login session. Please try again.'); }
    setAuthToken(accessToken);
    return response;
  },
};

const leadService = {
  getLeads: () => apiService.get('/field/leads'),
  getLeadDetails: leadId => apiService.get(`/field/leads/${encodeURIComponent(leadId)}`),
  getOnboardingTimeline: async leadId => {
    if ((typeof leadId !== 'string' && typeof leadId !== 'number') || !String(leadId).trim()) {
      throw new ApiError('A valid lead ID is required to load the onboarding timeline.', 400);
    }
    const response = await apiService.get(`/field/leads/${encodeURIComponent(String(leadId).trim())}/onboarding/timeline`);
    if (response == null) {
      throw new ApiError('The onboarding timeline response was empty.', 502);
    }
    // Leave the response untouched until its backend step contract is available.
    return response;
  },
  getAcquisitionTimeline: leadId =>
    apiService.get(`/field/leads/${encodeURIComponent(leadId)}/acquisition/timeline`, {
      headers: {'Cache-Control': 'no-cache', Pragma: 'no-cache'},
    }),
  createLead: lead => apiService.post('/field/leads', lead),
  updateAcquisitionStatus: (leadId, status) =>
    apiService.patch(`/field/leads/${encodeURIComponent(leadId)}/acquisition/status`, status),
};

const activationService = {
  getSalons: () => apiService.get('/field/activation/salons'),
  getSalonDetails: salonId => apiService.get(`/field/salons/${encodeURIComponent(salonId)}`),
  completeQr: async salonId => {
    const response = await apiService.post(`/field/salons/${encodeURIComponent(salonId)}/activation/qr-complete`, {});
    if (response?.success === false) {
      throw new ApiError(response.message || 'Unable to complete QR verification.', 200, response);
    }
    return response;
  },
};

const onboardingPath = salonId => {
  if ((typeof salonId !== 'string' && typeof salonId !== 'number') || !String(salonId).trim()) {
    throw new ApiError('A saved salon ID is required for this onboarding request.', 400);
  }
  return `/field/onboard/${encodeURIComponent(String(salonId).trim())}`;
};

const kycSalonPath = (salonId, resource) => {
  if ((typeof salonId !== 'string' && typeof salonId !== 'number') || !String(salonId).trim()) {
    throw new ApiError('A saved salon ID is required for this KYC request.', 400);
  }
  return `/field/onboard/${resource}/${encodeURIComponent(String(salonId).trim())}`;
};

const validateKycPayload = (payload, message) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError(message, 400);
  }
  return payload;
};

const validateBasicDetailsPayload = payload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError('Basic details are required for this onboarding request.', 400);
  }
  return payload;
};

const validateEmployeePayload = payload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError('Employee details are required.', 400);
  }
  return payload;
};

const employeePath = (salonId, employeeId) => {
  const basePath = `${onboardingPath(salonId)}/employees`;
  if (employeeId === undefined) { return basePath; }
  if ((typeof employeeId !== 'string' && typeof employeeId !== 'number') || !String(employeeId).trim()) {
    throw new ApiError('A saved employee ID is required for this request.', 400);
  }
  return `${basePath}/${encodeURIComponent(String(employeeId).trim())}`;
};

const servicePath = (salonId, serviceId) => {
  const basePath = `${onboardingPath(salonId)}/services`;
  if (serviceId === undefined) { return basePath; }
  if ((typeof serviceId !== 'string' && typeof serviceId !== 'number') || !String(serviceId).trim()) {
    throw new ApiError('A saved service ID is required for this request.', 400);
  }
  return `${basePath}/${encodeURIComponent(String(serviceId).trim())}`;
};

const employeeAvailabilityPath = (salonId, memberId) => {
  if ((typeof memberId !== 'string' && typeof memberId !== 'number') || !String(memberId).trim()) {
    throw new ApiError('A saved employee ID is required for this request.', 400);
  }
  return `${employeePath(salonId)}/${encodeURIComponent(String(memberId).trim())}/availability`;
};

const validateServicePayload = payload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError('Service details are required.', 400);
  }
  return payload;
};

const onboardingService = {
  getOnboardingStatus: async salonId => apiService.get(`${onboardingPath(salonId)}/onboarding-status`),
  getMonthlyAvailability: async (month, memberId) => {
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new ApiError('A month in YYYY-MM format is required.', 400);
    }
    if ((typeof memberId !== 'string' && typeof memberId !== 'number') || !String(memberId).trim()) {
      throw new ApiError('A saved employee ID is required for this request.', 400);
    }
    return apiService.get(`/field/onboard/availability/monthly?month=${encodeURIComponent(month)}&saloon_member_id=${encodeURIComponent(String(memberId).trim())}`);
  },
  // KYC endpoints use their own resources rather than the general
  // /field/onboard/:salonId route used by the earlier onboarding steps.
  getKycDetails: async salonId => apiService.get(kycSalonPath(salonId, 'bank-account-links')),
  updateKycDetails: async (salonId, payload) => apiService.patch(
    kycSalonPath(salonId, 'bank-account-links'),
    validateKycPayload(payload, 'KYC details are required.'),
  ),
  verifyBankAccount: async payload => apiService.post(
    '/field/onboard/bank-accounts/verify',
    validateKycPayload(payload, 'Bank details are required for verification.'),
  ),
  createBeneficiary: async payload => apiService.post(
    '/field/onboard/beneficiary',
    validateKycPayload(payload, 'Beneficiary details are required.'),
  ),
  getBeneficiary: async salonId => {
    try {
      return await apiService.get(kycSalonPath(salonId, 'beneficiaries'));
    } catch (error) {
      // The deployed API returns this when KYC has no beneficiary yet.
      // Other 404s (including missing routes) must remain errors.
      if (error.status === 404 && error.data?.success === false
        && error.data?.message === 'Beneficiary not found' && error.data?.data === null) {
        return null;
      }
      throw error;
    }
  },
  deleteBeneficiary: async salonId => apiService.delete(kycSalonPath(salonId, 'beneficiaries')),
  // Field users read the global catalog from the dedicated list route.
  getGlobalServices: async () => apiService.get('/services/list'),
  getAvailability: async salonId => apiService.get(`${onboardingPath(salonId)}/availability`),
  getAvailabilityState: async salonId => apiService.get(`${onboardingPath(salonId)}/availability/state`),
  saveAvailability: async (salonId, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ApiError('Salon availability details are required.', 400);
    }
    const response = await apiService.put(`${onboardingPath(salonId)}/availability`, payload);
    if (response?.success === false) {
      throw new ApiError(response.message || 'Unable to save salon availability.', 200, response);
    }
    return response;
  },
  createBasicDetails: async payload => apiService.post('/field/onboard/', validateBasicDetailsPayload(payload)),
  getBasicDetails: async salonId => apiService.get(onboardingPath(salonId)),
  updateBasicDetails: async (salonId, payload) => apiService.patch(onboardingPath(salonId), validateBasicDetailsPayload(payload)),
  deleteBasicDetails: async salonId => apiService.delete(onboardingPath(salonId)),
  getAddress: async salonId => apiService.get(`${onboardingPath(salonId)}/address`),
  saveAddress: async (salonId, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ApiError('Address details are required.', 400);
    }
    const endpoint = onboardingPath(salonId);
    const savedSalonId = String(salonId).trim();
    // The API projects this value to the `saloon_id` database column, while
    // onboarding responses expose it as `salon_id`. Send both supported API
    // spellings with the route ID so the server lookup always has a value.
    return apiService.put(`${endpoint}/address`, {...payload, salon_id: savedSalonId, saloon_id: savedSalonId});
  },
  deleteAddress: async salonId => apiService.delete(`${onboardingPath(salonId)}/address`),
  getEmployees: async salonId => apiService.get(employeePath(salonId)),
  getEmployeeAvailabilityState: async salonId => apiService.get(`${employeePath(salonId)}/availability/state`),
  saveEmployeeAvailability: async (salonId, memberId, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ApiError('Employee availability details are required.', 400);
    }
    return apiService.put(employeeAvailabilityPath(salonId, memberId), payload);
  },
  getEmployee: async (salonId, employeeId) => apiService.get(employeePath(salonId, employeeId)),
  // The working admin request sends a top-level array for employee creation.
  createEmployee: async (salonId, payload) => apiService.post(employeePath(salonId), [validateEmployeePayload(payload)]),
  updateEmployee: async (salonId, employeeId, payload) => apiService.put(employeePath(salonId, employeeId), validateEmployeePayload(payload)),
  updateEmployeeRole: async (salonId, employeeId, payload) => apiService.patch(`${employeePath(salonId, employeeId)}/role`, validateEmployeePayload(payload)),
  deleteEmployee: async (salonId, employeeId) => apiService.delete(employeePath(salonId, employeeId)),
  getServices: async salonId => apiService.get(servicePath(salonId)),
  getService: async (salonId, serviceId) => apiService.get(servicePath(salonId, serviceId)),
  createService: async (salonId, payload) => apiService.post(`${servicePath(salonId)}/bulk`, {
    services: [validateServicePayload(payload)],
  }),
  createServicesBulk: async (salonId, payload) => apiService.post(`${servicePath(salonId)}/bulk`, validateServicePayload(payload)),
  updateService: async (salonId, serviceId, payload) => apiService.put(servicePath(salonId, serviceId), validateServicePayload(payload)),
  patchService: async (salonId, serviceId, payload) => apiService.patch(servicePath(salonId, serviceId), validateServicePayload(payload)),
  deleteService: async (salonId, serviceId) => apiService.delete(servicePath(salonId, serviceId)),
  getImages: async salonId => apiService.get(`${onboardingPath(salonId)}/images`),
  presignImage: async (salonId, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ApiError('Image upload details are required.', 400);
    }
    return apiService.post(`${onboardingPath(salonId)}/images/presign`, payload);
  },
  confirmImage: async (salonId, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ApiError('Image confirmation details are required.', 400);
    }
    return apiService.post(`${onboardingPath(salonId)}/images/confirm`, payload);
  },
  deleteImage: async (salonId, imageId) => {
    if ((typeof imageId !== 'string' && typeof imageId !== 'number') || !String(imageId).trim()) {
      throw new ApiError('A saved image ID is required to delete an image.', 400);
    }
    return apiService.delete(`${onboardingPath(salonId)}/images/${encodeURIComponent(String(imageId).trim())}`);
  },
};

export {ApiError, activationService, authService, clearAuthToken, leadService, onboardingService, setAuthToken};
export default apiService;
