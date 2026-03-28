class CreateEntryTileMemberships < ActiveRecord::Migration[7.2]
  def change
    create_table :entry_tile_memberships do |t|
      t.references :entry, null: false, foreign_key: true
      t.integer :year, null: false
      t.string :mode, null: false
      t.integer :z, null: false
      t.integer :x, null: false
      t.integer :y, null: false

      t.timestamps
    end

    add_index :entry_tile_memberships, [:entry_id, :mode, :z, :x, :y], unique: true
    add_index :entry_tile_memberships, [:year, :mode, :z, :x, :y]
    add_index :entry_tile_memberships, [:mode, :z, :x, :y]
  end
end
