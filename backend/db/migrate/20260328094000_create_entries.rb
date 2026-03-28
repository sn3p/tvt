class CreateEntries < ActiveRecord::Migration[7.2]
  def change
    create_table :entries do |t|
      t.integer :year, null: false
      t.bigint :external_id, null: false
      t.string :pc4, null: false, limit: 4
      t.decimal :lat, null: false, precision: 10, scale: 7
      t.decimal :lng, null: false, precision: 10, scale: 7
      t.boolean :is_org, null: false, default: false
      t.datetime :source_fetched_at

      t.timestamps
    end

    add_index :entries, [:year, :external_id], unique: true
    add_index :entries, :year
    add_index :entries, :pc4
    add_index :entries, :is_org
  end
end
