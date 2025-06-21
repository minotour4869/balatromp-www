import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { AdapterAccount } from 'next-auth/adapters'

export const raw_history = pgTable(
  'raw_history',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    game_num: integer('game_num').notNull(),
    entry: json(),
  },
  (t) => [uniqueIndex('game_num_unique_idx').on(t.game_num)]
)
export const metadata = pgTable('metadata', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
})
export const player_games = pgTable(
  'player_games',
  {
    playerId: text('player_id').notNull(),
    playerName: text('player_name').notNull(),
    gameId: integer('game_id').notNull(),
    gameTime: timestamp('game_time').notNull(),
    gameType: text('game_type').notNull(),
    gameNum: integer('game_num').notNull(),
    playerMmr: real('player_mmr').notNull(),
    mmrChange: real('mmr_change').notNull(),
    opponentId: text('opponent_id').notNull(),
    opponentName: text('opponent_name').notNull(),
    opponentMmr: real('opponent_mmr').notNull(),
    result: text('result').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.gameNum] }),
    uniqueIndex('game_num_per_player_idx').on(t.playerId, t.gameNum),
  ]
)

export const users = pgTable('user', (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: 'date',
      withTimezone: true,
    })
    .default(sql`CURRENT_TIMESTAMP`),
  image: d.varchar({ length: 255 }),
  discord_id: d.varchar({ length: 255 }),
  twitch_url: d.varchar({ length: 255 }),
  youtube_url: d.varchar({ length: 255 }),
  role: d.varchar({ length: 255 }).notNull().default('user'),
}))

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}))

export const accounts = pgTable(
  'account',
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount['type']>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index('account_user_id_idx').on(t.userId),
  ]
)

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessions = pgTable(
  'session',
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: 'date', withTimezone: true }).notNull(),
  }),
  (t) => [index('t_user_id_idx').on(t.userId)]
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const verificationTokens = pgTable(
  'verification_token',
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: 'date', withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
)

export const branches = pgTable('mod_branches', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const releases = pgTable('mod_release', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull(),
  url: text('url').notNull(),
  smods_version: text('smods_version').default('latest'),
  lovely_version: text('lovely_version').default('latest'),
  branchId: integer('branch_id')
    .references(() => branches.id)
    .notNull()
    .default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const branchesRelations = relations(branches, ({ many }) => ({
  releases: many(releases),
}))

export const releasesRelations = relations(releases, ({ one }) => ({
  branch: one(branches, {
    fields: [releases.branchId],
    references: [branches.id],
  }),
}))
