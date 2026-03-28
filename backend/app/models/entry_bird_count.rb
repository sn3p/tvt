class EntryBirdCount < ApplicationRecord
  belongs_to :entry
  belongs_to :bird

  validates :rank, :count, presence: true
  validates :rank, numericality: { only_integer: true, greater_than: 0 }
  validates :count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :ordered, -> { order(:rank, :bird_id) }
end
