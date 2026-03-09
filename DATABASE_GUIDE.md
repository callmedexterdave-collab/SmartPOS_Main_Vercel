# Database Migration and Schema Guide

This document provides a comprehensive overview of the database schema, migration process, and maintenance procedures for the SmartPOS application.

## 1. Schema Overview

The database schema is defined in `shared/schema.ts` using Drizzle ORM. It includes the following tables:

- **`users`**: Stores user authentication and profile information.
- **`products`**: Manages inventory and product details.
- **`sales`**: Records all sales transactions.
- **`sale_items`**: Contains individual items for each sale.
- **`staff`**: Manages staff member information and permissions.
- **`expenses`**: Tracks business expenses.
- **`purchases`**: Records product purchases from suppliers.
- **`creditors`**: Manages information about creditors.

### Key Improvements:

- **Normalization**: The `sales` table was normalized by creating a separate `sale_items` table to store individual sale items, improving data integrity and query performance.
- **Unique Constraints**: Added unique constraints to `users` and `products` tables to prevent duplicate entries.
- **Foreign Keys**: Established foreign key relationships between tables to enforce relational integrity.

## 2. Migration Process

Database migrations are managed using `drizzle-kit`. The following steps outline the process for applying schema changes:

1. **Modify Schema**: Make the necessary changes to the schema definition in `shared/schema.ts`.

2. **Generate Migration Script**: Run the following command to generate a migration script that reflects the schema changes:

   ```bash
   npm run db:push
   ```

   This command will compare the schema definition with the database and generate the necessary SQL to update the database.

3. **Apply Migrations**: The `db:push` command automatically applies the generated migrations to the database.

## 3. Database Maintenance

- **Backup**: Regularly back up the `server/data/smartpos.db` file to prevent data loss.
- **Monitoring**: Monitor database performance and query execution times to identify potential bottlenecks.
- **Schema Changes**: Follow the migration process described above when making any changes to the database schema.