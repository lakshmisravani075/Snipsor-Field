const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

// A beneficiary is created only by the final successful KYC submission. It
// remains available after the app's local state has been cleared.
export const readSavedBeneficiary = response => {
  const root = response?.data || response;
  if (!root || typeof root !== 'object' || Array.isArray(root)) { return null; }
  const directRecord = (root.beneficiary_id || root.beneficiaryId
    || ((root.saloon_id || root.salon_id || root.saloonId || root.salonId)
      && (root.account_number || root.accountNumber)
      && (root.business_type || root.businessType || root.legal_business_name || root.legalBusinessName))) ? root : null;
  const beneficiary = root.beneficiary || root.beneficiaries?.[0] || root.data?.beneficiary || directRecord;
  return beneficiary && typeof beneficiary === 'object' && !Array.isArray(beneficiary)
    && Object.keys(beneficiary).length ? beneficiary : null;
};

const STEP_BY_NAME = {
  BASIC_DETAILS: 1, FILES_MEDIA: 2, FILES_AND_MEDIA: 2, ADDRESS: 3,
  SERVICES: 4, EMPLOYEES: 5, SALON_AVAILABILITY: 6,
  EMPLOYEE_AVAILABILITY: 7, KYC: 8, PAYMENT_DETAILS_ADDED: 8,
};

const asStep = value => {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 8) { return numeric; }
  const name = text(value).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return STEP_BY_NAME[name] || null;
};

const isComplete = value => {
  if (value === true) { return true; }
  return ['COMPLETE', 'COMPLETED', 'DONE', 'FINISHED', 'SUCCESS'].includes(text(value).trim().toUpperCase());
};

const isCompletedOnboardingStatus = value => [
  'ONBOARDING_COMPLETED', 'ONBOARDING_COMPLETE', 'COMPLETED', 'COMPLETE',
  'PAYMENT_DETAILS_ADDED',
].includes(text(value).trim().toUpperCase().replace(/[ -]+/g, '_'));

// The timeline has appeared in more than one backend response shape. Read the
// documented step/status concepts without tying navigation to a wrapper name.
export const resolveOnboardingResumeStep = (timeline, fallbackStep = 1) => {
  const root = timeline?.data ?? timeline;
  if (!root || typeof root !== 'object') { return asStep(fallbackStep) || 1; }
  const sources = [root, root.progress, root.onboarding, root.timeline].filter(source => source && typeof source === 'object');
  for (const source of sources) {
    for (const key of ['next_step', 'nextStep', 'pending_step', 'pendingStep', 'current_step', 'currentStep', 'onboarding_step', 'onboardingStep']) {
      const step = asStep(source[key]);
      if (step) { return step; }
    }
  }
  const lists = [root.steps, root.timeline, root.items, root.data, root.onboarding?.steps, root.progress?.steps].filter(Array.isArray);
  for (const steps of lists) {
    const normalized = steps.map(item => ({
      step: asStep(item?.step_number ?? item?.stepNumber ?? item?.step ?? item?.name ?? item?.key ?? item?.id),
      complete: isComplete(item?.is_completed ?? item?.isComplete ?? item?.completed ?? item?.status),
    })).filter(item => item.step);
    if (normalized.length) {
      const pending = normalized.sort((a, b) => a.step - b.step).find(item => !item.complete);
      return pending?.step || Math.min(8, normalized[normalized.length - 1].step + 1);
    }
  }
  return asStep(fallbackStep) || 1;
};

const assigneeName = lead => {
  const directName = text(lead.assigned_to_name || lead.assignedToName || lead.assignee_name || lead.assigneeName
    || lead.assigned_agent_name || lead.assignedAgentName).trim();
  if (directName) { return directName; }
  const people = [lead.assigned_to, lead.assignedTo, lead.assignee, lead.assigned_user, lead.assignedUser,
    lead.assigned_to_user, lead.assignedToUser, lead.assigned_agent, lead.assignedAgent,
    lead.assigned_user_details, lead.assignedUserDetails];
  for (const person of people) {
    if (!person || typeof person !== 'object') { continue; }
    const name = text(person.name || person.full_name || person.fullName).trim()
      || [text(person.first_name || person.firstName), text(person.last_name || person.lastName)].filter(Boolean).join(' ').trim();
    if (name) { return name; }
  }
  // assigned_to is a foreign key when the API does not include the user relation.
  return 'Name unavailable';
};

export const formatAssignedOn = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})
    : text(value).trim();
};

export const extractSavedSalonId = source => {
  // Timeline and lead-detail endpoints wrap the saved salon inconsistently
  // (including data.data and lead.onboarding).  Walk only known onboarding
  // containers, rather than treating a lead's generic `id` as a salon ID.
  const nodes = [source];
  const seen = new Set();
  const containers = ['data', 'lead', 'onboarding', 'progress', 'timeline', 'salon_details', 'saloon_details', 'salon', 'saloon', 'basic_details', 'basicDetails'];
  while (nodes.length) {
    const node = nodes.shift();
    if (!node || typeof node !== 'object' || Array.isArray(node) || seen.has(node)) { continue; }
    seen.add(node);
    const directId = text(node.saloon_id || node.saloonId || node.salon_id || node.salonId).trim();
    if (directId) { return directId; }
    for (const key of containers) {
      const child = node[key];
      if (!child || typeof child !== 'object' || Array.isArray(child)) { continue; }
      // `id` is safe only inside an explicitly salon-shaped object.
      if (['salon_details', 'saloon_details', 'salon', 'saloon', 'basic_details', 'basicDetails'].includes(key)) {
        const salonId = text(child.saloon_id || child.saloonId || child.salon_id || child.salonId || child.id).trim();
        if (salonId) { return salonId; }
      }
      nodes.push(child);
    }
  }
  return '';
};

export const extractTaskLeads = response => {
  const candidates = [response, response?.data, response?.leads, response?.items, response?.results,
    response?.data?.leads, response?.data?.items, response?.data?.results, response?.data?.rows];
  const leads = candidates.find(Array.isArray);
  if (!leads) {
    throw new Error('The leads response did not contain a lead list. Please try again.');
  }
  return leads;
};

export const normalizeOnboardingTask = lead => {
  const onboarding = lead.onboarding || {};
  const address = lead.address;
  const step = Number(lead.onboarding_step ?? lead.onboardingStep ?? onboarding.current_step);
  const rawStatus = text(lead.onboarding_status || lead.onboardingStatus || onboarding.status || lead.status)
    .toUpperCase().replace(/[ -]+/g, '_');
  const onboardingComplete = isCompletedOnboardingStatus(rawStatus);
  const status = rawStatus === 'KYC_PENDING' ? 'KYC Pending'
    : ['IN_PROGRESS', 'ONBOARDING_IN_PROGRESS'].includes(rawStatus) || step > 1 ? 'In Progress' : 'New';
  return {
    ...lead,
    id: text(lead.id || lead.lead_id || lead.leadId),
    leadId: text(lead.id || lead.lead_id || lead.leadId),
    salon_id: extractSavedSalonId(lead),
    name: text(lead.salon_name || lead.salonName || lead.name),
    location: text(address) || text(address?.complete_address || address?.formatted_address || lead.complete_address || lead.completeAddress),
    contact: text(lead.contact_person || lead.contactPerson || lead.contact_person_name || lead.contactPersonName || lead.contact),
    phone: text(lead.phone_number || lead.phoneNumber || lead.phone),
    whatsapp: text(lead.whatsapp_number || lead.whatsappNumber || lead.whatsapp),
    businessType: text(lead.business_type || lead.businessType || lead.salon_type),
    leadSource: text(lead.lead_source || lead.leadSource || lead.source),
    assignedOn: text(lead.assigned_at || lead.assigned_on || lead.assignedAt || lead.assignedOn || lead.assigned_date || lead.assignedDate),
    assignee: assigneeName(lead),
    activity: text(lead.activity || lead.distance_label || lead.distanceLabel),
    acquisitionStatus: lead.status,
    status,
    onboardingComplete,
    onboardingStep: Number.isInteger(step) && step >= 1 && step <= 8 ? step : 1,
  };
};

export const mergeTaskDetails = (response, summary) => {
  const container = response?.data || response;
  const record = container?.lead || container;
  if (response?.success === false || !record || Array.isArray(record) || typeof record !== 'object'
    || !['id', 'lead_id', 'leadId', 'salon_name', 'salonName', 'name'].some(key => record[key])) {
    throw new Error('The response did not contain lead details. Please try again.');
  }
  const normalized = normalizeOnboardingTask(record);
  const details = {...summary, ...record};
  for (const key of ['id', 'leadId', 'name', 'location', 'contact', 'phone', 'whatsapp', 'businessType', 'leadSource', 'assignedOn', 'activity']) {
    details[key] = normalized[key] || summary[key] || '';
  }
  details.assignee = normalized.assignee !== 'Name unavailable' ? normalized.assignee : summary.assignee || normalized.assignee;
  details.salon_id = normalized.salon_id || extractSavedSalonId(container) || extractSavedSalonId(summary);
  const hasProgress = record.onboarding_status || record.onboardingStatus || record.onboarding || record.onboarding_step || record.onboardingStep;
  details.status = hasProgress ? normalized.status : summary.status;
  details.onboardingStep = hasProgress ? normalized.onboardingStep : summary.onboardingStep;
  return details;
};
