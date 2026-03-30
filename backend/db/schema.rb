# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_03_30_194500) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "birds", force: :cascade do |t|
    t.integer "external_id", null: false
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["external_id"], name: "index_birds_on_external_id", unique: true
  end

  create_table "entries", force: :cascade do |t|
    t.integer "year", null: false
    t.bigint "external_id", null: false
    t.string "pc4", limit: 4, null: false
    t.decimal "lat", precision: 10, scale: 7, null: false
    t.decimal "lng", precision: 10, scale: 7, null: false
    t.boolean "is_org", default: false, null: false
    t.datetime "source_fetched_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["is_org"], name: "index_entries_on_is_org"
    t.index ["pc4"], name: "index_entries_on_pc4"
    t.index ["year", "external_id"], name: "index_entries_on_year_and_external_id", unique: true
    t.index ["year", "lat", "lng"], name: "index_entries_on_year_lat_lng"
    t.index ["year", "pc4", "is_org"], name: "index_entries_on_year_pc4_is_org"
    t.index ["year"], name: "index_entries_on_year"
  end

  create_table "entry_bird_counts", force: :cascade do |t|
    t.bigint "entry_id", null: false
    t.bigint "bird_id", null: false
    t.integer "rank", null: false
    t.integer "count", null: false
    t.string "bird_name_cache"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bird_id"], name: "index_entry_bird_counts_on_bird_id"
    t.index ["entry_id", "bird_id"], name: "index_entry_bird_counts_on_entry_id_and_bird_id", unique: true
    t.index ["entry_id", "rank"], name: "index_entry_bird_counts_on_entry_id_and_rank"
    t.index ["entry_id"], name: "index_entry_bird_counts_on_entry_id"
  end

  create_table "entry_tile_memberships", force: :cascade do |t|
    t.bigint "entry_id", null: false
    t.integer "year", null: false
    t.string "mode", null: false
    t.integer "z", null: false
    t.integer "x", null: false
    t.integer "y", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["entry_id", "mode", "z", "x", "y"], name: "idx_on_entry_id_mode_z_x_y_fc8526d2f2", unique: true
    t.index ["entry_id"], name: "index_entry_tile_memberships_on_entry_id"
    t.index ["mode", "z", "x", "y"], name: "index_entry_tile_memberships_on_mode_and_z_and_x_and_y"
    t.index ["year", "mode", "z", "x", "y"], name: "idx_on_year_mode_z_x_y_052f1a9e38"
  end

  add_foreign_key "entry_bird_counts", "birds"
  add_foreign_key "entry_bird_counts", "entries"
  add_foreign_key "entry_tile_memberships", "entries"
end
