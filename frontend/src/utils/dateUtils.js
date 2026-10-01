/**
 * Safe date formatting utility
 * Handles invalid dates gracefully by returning a fallback
 */

export function formatDate(dateValue, fallback = '—') {
  if (!dateValue) return fallback;
  
  try {
    const date = new Date(dateValue);
    
    // Check if the date is invalid
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    return date.toLocaleString('en-GB');
  } catch (error) {
    return fallback;
  }
}

export function formatDateString(dateValue, fallback = '—') {
  if (!dateValue) return fallback;
  
  try {
    const date = new Date(dateValue);
    
    // Check if the date is invalid
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    return date.toLocaleDateString('en-GB');
  } catch (error) {
    return fallback;
  }
}

export function formatTimeString(dateValue, fallback = '—') {
  if (!dateValue) return fallback;
  
  try {
    const date = new Date(dateValue);
    
    // Check if the date is invalid
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    return date.toLocaleTimeString('en-US');
  } catch (error) {
    return fallback;
  }
}

export function getBusinessDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${values.year}-${values.month}-${values.day}`;
}
