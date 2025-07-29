// User-specific filtering methods to add to server/storage.ts

  // New method to filter processes by user assignment
  async listUserProcesses(organizationId: number, userId: number): Promise<OrganizationProcess[]> {
    try {
      console.log(`Fetching user-specific processes for user ${userId} in organization ${organizationId}`);
      
      // Get user's role first to determine if they should see everything or filtered results
      const [user] = await db
        .select({
          role: users.role
        })
        .from(users)
        .where(eq(users.id, userId));
      
      // If user is an admin, owner, or manager, return all processes
      if (user && ['owner', 'admin', 'manager'].includes(user.role)) {
        console.log(`User ${userId} has role ${user.role} - returning all processes`);
        return this.listProcesses(organizationId);
      }
      
      // For other users, return only assigned processes
      const processes = await db
        .select({
          id: organizationProcesses.id,
          name: organizationProcesses.name,
          description: organizationProcesses.description,
          status: organizationProcesses.status,
          inductionDays: organizationProcesses.inductionDays,
          trainingDays: organizationProcesses.trainingDays,
          certificationDays: organizationProcesses.certificationDays,
          ojtDays: organizationProcesses.ojtDays,
          ojtCertificationDays: organizationProcesses.ojtCertificationDays,
          organizationId: organizationProcesses.organizationId,
          lineOfBusinessId: organizationProcesses.lineOfBusinessId,
          createdAt: organizationProcesses.createdAt,
          updatedAt: organizationProcesses.updatedAt,
          lineOfBusinessName: organizationLineOfBusinesses.name,
        })
        .from(userProcesses)
        .innerJoin(
          organizationProcesses,
          eq(userProcesses.processId, organizationProcesses.id)
        )
        .leftJoin(
          organizationLineOfBusinesses,
          eq(organizationProcesses.lineOfBusinessId, organizationLineOfBusinesses.id)
        )
        .where(eq(userProcesses.userId, userId))
        .where(eq(organizationProcesses.organizationId, organizationId));
      
      console.log(`Found ${processes.length} assigned processes for user ${userId}`);
      return processes;
    } catch (error: any) {
      console.error('Error fetching user-specific processes:', error);
      throw new Error(`Failed to fetch user-specific processes: ${error.message}`);
    }
  }

  // New method to filter LOBs by user assignment
  async listUserLineOfBusinesses(organizationId: number, userId: number): Promise<OrganizationLineOfBusiness[]> {
    try {
      console.log(`Fetching user-specific line of businesses for user ${userId} in organization ${organizationId}`);
      
      // Get user's role first to determine if they should see everything or filtered results
      const [user] = await db
        .select({
          role: users.role
        })
        .from(users)
        .where(eq(users.id, userId));
      
      // If user is an admin, owner, or manager, return all LOBs
      if (user && ['owner', 'admin', 'manager'].includes(user.role)) {
        console.log(`User ${userId} has role ${user.role} - returning all line of businesses`);
        return this.listLineOfBusinesses(organizationId);
      }
      
      // For other users, return only assigned LOBs
      const lobs = await db
        .select({
          id: organizationLineOfBusinesses.id,
          name: organizationLineOfBusinesses.name,
          description: organizationLineOfBusinesses.description,
          organizationId: organizationLineOfBusinesses.organizationId,
          createdAt: organizationLineOfBusinesses.createdAt,
        })
        .from(userProcesses)
        .innerJoin(
          organizationLineOfBusinesses,
          eq(userProcesses.lineOfBusinessId, organizationLineOfBusinesses.id)
        )
        .where(eq(userProcesses.userId, userId))
        .where(eq(organizationLineOfBusinesses.organizationId, organizationId))
        .groupBy(organizationLineOfBusinesses.id);
      
      console.log(`Found ${lobs.length} assigned line of businesses for user ${userId}`);
      return lobs;
    } catch (error: any) {
      console.error('Error fetching user-specific line of businesses:', error);
      throw new Error(`Failed to fetch user-specific line of businesses: ${error.message}`);
    }
  }

  // New method to filter locations by user assignment
  async listUserLocations(organizationId: number, userId: number): Promise<OrganizationLocation[]> {
    try {
      console.log(`Fetching user-specific locations for user ${userId} in organization ${organizationId}`);
      
      // Get user's role first to determine if they should see everything or filtered results
      const [user] = await db
        .select({
          role: users.role
        })
        .from(users)
        .where(eq(users.id, userId));
      
      // If user is an admin, owner, or manager, return all locations
      if (user && ['owner', 'admin', 'manager'].includes(user.role)) {
        console.log(`User ${userId} has role ${user.role} - returning all locations`);
        return this.listLocations(organizationId);
      }
      
      // For other users, return only assigned locations
      const locations = await db
        .select({
          id: organizationLocations.id,
          name: organizationLocations.name,
          address: organizationLocations.address,
          city: organizationLocations.city,
          state: organizationLocations.state,
          country: organizationLocations.country,
          organizationId: organizationLocations.organizationId,
          createdAt: organizationLocations.createdAt,
        })
        .from(userProcesses)
        .innerJoin(
          organizationLocations,
          eq(userProcesses.locationId, organizationLocations.id)
        )
        .where(eq(userProcesses.userId, userId))
        .where(eq(organizationLocations.organizationId, organizationId))
        .groupBy(organizationLocations.id);
      
      console.log(`Found ${locations.length} assigned locations for user ${userId}`);
      return locations;
    } catch (error: any) {
      console.error('Error fetching user-specific locations:', error);
      throw new Error(`Failed to fetch user-specific locations: ${error.message}`);
    }
  }