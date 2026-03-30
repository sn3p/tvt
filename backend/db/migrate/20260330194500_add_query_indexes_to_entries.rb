class AddQueryIndexesToEntries < ActiveRecord::Migration[7.2]
  def change
    add_index :entries, [:year, :lat, :lng], name: "index_entries_on_year_lat_lng"
    add_index :entries, [:year, :pc4, :is_org], name: "index_entries_on_year_pc4_is_org"
  end
end
