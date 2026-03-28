class CreateBirds < ActiveRecord::Migration[7.2]
  def change
    create_table :birds do |t|
      t.integer :external_id, null: false
      t.string :name, null: false

      t.timestamps
    end

    add_index :birds, :external_id, unique: true
  end
end
