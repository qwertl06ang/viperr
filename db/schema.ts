import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const libraries=sqliteTable('libraries',{userId:text('user_id').primaryKey(),savedJson:text('saved_json').notNull().default('[]'),updatedAt:integer('updated_at').notNull()});
export const votes=sqliteTable('votes',{userId:text('user_id').primaryKey(),albumId:text('album_id').notNull(),updatedAt:integer('updated_at').notNull()},table=>[index('idx_votes_album').on(table.albumId)]);
export const playlists=sqliteTable('playlists',{id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),title:text('title').notNull(),albumIds:text('album_ids').notNull(),createdAt:integer('created_at').notNull()},table=>[index('idx_playlists_owner_created').on(table.ownerId,table.createdAt)]);
