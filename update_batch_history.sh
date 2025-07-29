#!/bin/bash

# Get all line numbers where the batch history is recorded without user ID
lines=$(grep -n "batch.organizationId
      );" server/routes.ts | cut -d ':' -f1)

# Loop through each line and insert the user ID parameter
for line in $lines; do
  # Calculate the line number where we want to add our insertion
  insert_line=$((line - 1))
  
  # Insert the user ID parameter
  sed -i "${insert_line}s/.*/        batch.organizationId,
        req.user.id \/\/ Pass the actual user ID who triggered the action/" server/routes.ts
  
  # Update the comment above the addBatchHistoryRecord function
  comment_line=$((line - 10))
  sed -i "${comment_line}s/\/\/ Record batch history first/\/\/ Record batch history first with the actual user who made the change/" server/routes.ts
done

echo "Updates completed"
