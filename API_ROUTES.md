# Create Batch Form API Routes

## 1. Get Locations
- **Endpoint**: `/api/organizations/${organizationId}/locations`
- **Method**: GET
- **Purpose**: Fetches all locations for the organization
- **Response**: Array of locations with id and name

## 2. Get Line of Businesses by Location
- **Endpoint**: `/api/organizations/${organizationId}/locations/${locationId}/line-of-businesses`
- **Method**: GET
- **Purpose**: Fetches LOBs mapped to a specific location through user_processes
- **Response**: Array of LOBs with id and name

## 3. Get Processes by LOB
- **Endpoint**: `/api/organizations/${organizationId}/line-of-businesses/${lobId}/processes`
- **Method**: GET
- **Purpose**: Fetches processes for selected LOB
- **Response**: Array of processes with id and name

## 4. Get Trainers
- **Endpoint**: `/api/organizations/${organizationId}/users`
- **Method**: GET
- **Purpose**: Fetches all users with trainer role
- **Response**: Array of users filtered by role='trainer'

## 5. Create Batch
- **Endpoint**: `/api/organizations/${organizationId}/batches`
- **Method**: POST
- **Purpose**: Creates a new batch
- **Request Body**:
  ```typescript
  {
    batchCode: string;
    name: string;
    locationId: number;
    lineOfBusinessId: number;
    processId: number;
    trainerId: number;
    startDate: string;
    endDate: string;
    capacityLimit: number;
    status: 'planned'; // Default value
    organizationId: number;
  }
  ```
