const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export const mergeActivationDetails = (response, summary) => {
  const container = response?.data || response;
  const record = container?.salon ? {...container, ...container.salon, salon: undefined} : container;
  if (response?.success === false || !record || typeof record !== 'object' || Array.isArray(record)
    || !['id', 'salon_id', 'saloon_id', 'salonId', 'saloonId', 'salon_name', 'salonName', 'name'].some(key => record[key])) {
    throw new Error('The response did not contain salon details. Please try again.');
  }
  const details = normalizeActivationSalon(record);
  const result = {...summary, ...record};
  for (const key of ['id', 'displayId', 'name', 'address', 'owner', 'phone', 'qrId', 'date']) {
    result[key] = details[key] || summary[key];
  }
  result.displayId = text(record.salon_code || record.salonCode) || summary.displayId || details.id;
  // General salon status (e.g. ACTIVE) must not replace activation progress.
  result.status = ['QR Pending', 'Training Pending', 'Ready Activation'].includes(details.status)
    ? details.status : summary.status;
  result.activationStatus = details.activationStatus || summary.activationStatus || '';
  return result;
};

export const extractActivationSalons = response => {
  const candidates = [response, response?.data, response?.salons, response?.items, response?.results,
    response?.data?.salons, response?.data?.items, response?.data?.results];
  const salons = candidates.find(Array.isArray);
  if (!salons) { throw new Error('The response did not contain a salon list. Please try again.'); }
  return salons;
};

export const normalizeActivationSalon = record => {
  const salon = record.salon || record;
  const activation = record.activation || salon.activation || {};
  const id = text(salon.salon_id || salon.saloon_id || salon.salonId || salon.saloonId || salon.id);
  const rawStatus = text(record.activation_status || record.activationStatus || activation.status || record.status || salon.status);
  const activationStatus = text(record.activation_status || record.activationStatus || activation.status);
  const statusKey = rawStatus.toUpperCase().replace(/[ -]+/g, '_');
  const status = {QR_PENDING: 'QR Pending', TRAINING_PENDING: 'Training Pending', TRAINING_COMPLETED: 'Ready Activation', TRAINING_COMPLETE: 'Ready Activation', READY_ACTIVATION: 'Ready Activation', READY_TO_ACTIVATE: 'Ready Activation', READY_FOR_ACTIVATION: 'Ready Activation', ACTIVE: 'Active', ACTIVATED: 'Active', ACTIVATION_COMPLETED: 'Active'}[statusKey]
    || rawStatus;
  const address = salon.address || salon.address_details || salon.saloon_address || salon.salon_address || salon.location;
  const owner = salon.owner || salon.owner_details || salon.contact || salon.contact_details;
  const completedAt = salon.onboarding_completed_at || record.onboarding_completed_at || salon.onboarding?.completed_at;
  const completedDate = completedAt ? new Date(completedAt) : null;
  return {
    ...record, ...salon,
    id,
    displayId: text(salon.salon_code || salon.salonCode) || id,
    name: text(salon.salon_name || salon.salonName || salon.name),
    address: text(address) || text(address?.complete_address || address?.formatted_address || address?.address_line1 || address?.line1 || salon.complete_address || salon.address_line1),
    owner: text(owner?.name || owner?.full_name || salon.owner_name || salon.contact_person || salon.contact_name || salon.ownerName || owner),
    phone: text(salon.phone_number || salon.phoneNumber || salon.mobile_number || salon.mobileNumber || salon.contact_number || salon.contactNumber || owner?.phone_number || owner?.mobile_number || owner?.phone || salon.phone),
    qrId: text(salon.qr_id || salon.qrId || salon.qr_code_id || activation.qr_id),
    activationStatus,
    status,
    date: completedDate && !Number.isNaN(completedDate.getTime())
      ? `Completed on ${completedDate.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`
      : text(salon.date),
  };
};
