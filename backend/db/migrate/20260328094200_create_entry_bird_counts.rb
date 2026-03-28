class CreateEntryBirdCounts < ActiveRecord::Migration[7.2]
  def change
    create_table :entry_bird_counts do |t|
      t.references :entry, null: false, foreign_key: true
      t.references :bird, null: false, foreign_key: true
      t.integer :rank, null: false
      t.integer :count, null: false
      t.string :bird_name_cache

      t.timestamps
    end

    add_index :entry_bird_counts, [:entry_id, :bird_id], unique: true
    add_index :entry_bird_counts, :bird_id
    add_index :entry_bird_counts, [:entry_id, :rank]
  end
end
