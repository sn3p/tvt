class Bird < ApplicationRecord
  has_many :entry_bird_counts, dependent: :restrict_with_exception
  has_many :entries, through: :entry_bird_counts

  validates :external_id, :name, presence: true
  validates :external_id, numericality: { only_integer: true, greater_than: 0 }
end
