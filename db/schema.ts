import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const entries = sqliteTable('entries', {
 id:text('id').primaryKey(), name:text('name').notNull(), nameKey:text('name_key').notNull().unique(),
 message:text('message').notNull(), ownerHash:text('owner_hash').notNull(),
 createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull()
});
