/**
 * Utility functions for attendance validation and auto-marking
 */
import { isWithinInterval, parseISO, format, isWeekend } from 'date-fns';

/**
 * Holiday information interface
 */
interface HolidayInfo {
  date: string;
  name: string;
}

/**
 * Batch information required for attendance validation
 */
interface BatchInfo {
  startDate: string;
  endDate: string;
  weeklyOffDays: string[];
  considerHolidays: boolean;
  // Phase-specific dates
  inductionStartDate?: string;
  inductionEndDate?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  certificationStartDate?: string;
  certificationEndDate?: string;
  ojtStartDate?: string;
  ojtEndDate?: string;
  ojtCertificationStartDate?: string;
  ojtCertificationEndDate?: string;
  // Current phase
  status: string;
}

/**
 * Result of date validation for attendance marking
 */
interface DateValidationResult {
  isValid: boolean;
  reason?: string;
  autoMarkedStatus?: string;
}

/**
 * Validates if a date is valid for attendance marking in a given batch
 * @param date The date to validate in YYYY-MM-DD format
 * @param batch The batch information
 * @param holidayList List of holidays (optional)
 * @returns Object containing validity and auto-marked status if applicable
 */
export function validateAttendanceDate(
  date: string,
  batch: BatchInfo,
  holidayList: HolidayInfo[] = []
): DateValidationResult {
  try {
    const dateObj = parseISO(date);
    const today = new Date();
    
    // Format today as YYYY-MM-DD to compare with dates
    const formattedToday = format(today, 'yyyy-MM-dd');
    
    // Validate date is not in the future
    if (date > formattedToday) {
      return {
        isValid: false,
        reason: 'Cannot mark attendance for future dates'
      };
    }
    
    // Validate date is within batch start and end dates
    const batchStartDate = parseISO(batch.startDate);
    const batchEndDate = parseISO(batch.endDate);
    
    if (!isWithinInterval(dateObj, { start: batchStartDate, end: batchEndDate })) {
      return {
        isValid: false,
        reason: 'Date is outside the batch duration'
      };
    }

    // Validate date is within the current phase
    const phaseStartDate = getCurrentPhaseStartDate(batch);
    const phaseEndDate = getCurrentPhaseEndDate(batch);
    
    if (phaseStartDate && phaseEndDate) {
      const phaseStart = parseISO(phaseStartDate);
      const phaseEnd = parseISO(phaseEndDate);
      
      if (!isWithinInterval(dateObj, { start: phaseStart, end: phaseEnd })) {
        return {
          isValid: false,
          reason: `Date is not within the current "${batch.status}" phase of the batch`
        };
      }
    }
    
    // Check for weekly off day
    const dayOfWeek = format(dateObj, 'EEEE').toLowerCase();
    if (batch.weeklyOffDays && batch.weeklyOffDays.includes(dayOfWeek)) {
      return {
        isValid: true,
        autoMarkedStatus: 'weekly_off',
        reason: `Auto-marked as weekly off (${dayOfWeek})`
      };
    }
    
    // Check for public holiday
    if (batch.considerHolidays && holidayList && holidayList.length > 0) {
      const holiday = holidayList.find(h => h.date === date);
      if (holiday) {
        return {
          isValid: true,
          autoMarkedStatus: 'public_holiday',
          reason: `Auto-marked as public holiday (${holiday.name})`
        };
      }
    }
    
    // Date is valid for regular attendance marking
    return {
      isValid: true
    };
  } catch (error) {
    console.error('Error validating attendance date:', error);
    return {
      isValid: false,
      reason: 'Invalid date format or validation error'
    };
  }
}

/**
 * Gets the start date for the current phase in the batch
 */
function getCurrentPhaseStartDate(batch: BatchInfo): string | undefined {
  switch (batch.status) {
    case 'induction':
      return batch.inductionStartDate || batch.startDate;
    case 'training':
      return batch.trainingStartDate;
    case 'certification':
      return batch.certificationStartDate;
    case 'ojt':
      return batch.ojtStartDate;
    case 'ojt_certification':
      return batch.ojtCertificationStartDate;
    default:
      return batch.startDate;
  }
}

/**
 * Gets the end date for the current phase in the batch
 */
function getCurrentPhaseEndDate(batch: BatchInfo): string | undefined {
  switch (batch.status) {
    case 'induction':
      return batch.inductionEndDate;
    case 'training':
      return batch.trainingEndDate;
    case 'certification':
      return batch.certificationEndDate;
    case 'ojt':
      return batch.ojtEndDate;
    case 'ojt_certification':
      return batch.ojtCertificationEndDate;
    default:
      return batch.endDate;
  }
}