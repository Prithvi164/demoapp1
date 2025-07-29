/**
 * Service for managing holidays
 */
import { db } from '../db';
import { organizationHolidays } from '@shared/schema';
import { eq, between } from 'drizzle-orm';
import { format, parse } from 'date-fns';

/**
 * Holiday data structure
 */
export interface Holiday {
  id: number;
  name: string;
  date: string;
  description?: string;
  organizationId: number;
}

/**
 * Get all holidays for an organization within a date range
 * 
 * @param organizationId The ID of the organization
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format 
 * @returns Array of holidays in the date range
 */
export async function getHolidaysInRange(
  organizationId: number,
  startDate: string,
  endDate: string
): Promise<Holiday[]> {
  try {
    // Format dates for the query
    const formattedStartDate = startDate;
    const formattedEndDate = endDate;

    // Query holidays in the date range
    const holidays = await db
      .select()
      .from(organizationHolidays)
      .where(
        eq(organizationHolidays.organizationId, organizationId),
        between(organizationHolidays.date, formattedStartDate, formattedEndDate)
      );

    return holidays.map((holiday: any) => ({
      id: holiday.id,
      name: holiday.name,
      date: format(holiday.date, 'yyyy-MM-dd'),
      description: holiday.description || undefined,
      organizationId: holiday.organizationId
    }));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }
}